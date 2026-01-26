"""
Generation Service - IMPROVED VERSION
Fixes: race conditions, atomicity, limits, idempotency, error handling
"""
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Callable
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from app.models import User, Generation, GenerationStatus, Transaction, TransactionType
from app.schemas.generation import GenerationRequest, GenerationType
from app.services.aiml import aiml_client
from app.config import settings
from app.exceptions import (
    UserNotFoundError,
    UserBannedError,
    InsufficientCreditsError,
    ConcurrentUpdateError,
    RateLimitError,
    MaxActiveGenerationsError,
    GenerationNotFoundError,
    GenerationTimeoutError,
    DuplicateRequestError,
)
import structlog

logger = structlog.get_logger()


# ========== CONFIGURATION ==========

# Model pricing (in credits)
MODEL_PRICES = {
    # Video models
    "kling-video/v2.0/master/text-to-video": 15,
    "kling-video/v2.0/master/image-to-video": 15,
    "kling-video/v1.6/pro/text-to-video": 10,
    "kling-video/v1.5/pro/text-to-video": 7,
    "minimax-video/video-01": 12,
    "runway/gen4-turbo": 15,
    "bytedance/seedance-1-lite": 8,
    "google/veo-3.1-generate": 20,
    "wan-ai/wan2.1-t2v-turbo": 5,
    "wan-ai/wan2.6-t2v-turbo": 7,
    "openai/sora-2-pro": 20,
    
    # Image models
    "flux-pro/v1.1-ultra": 3,
    "google/imagen-4": 4,
    "gpt-image-1": 5,
    "nano-banana": 1,
}

# Estimated generation times (seconds)
GENERATION_TIMES = {
    "kling-video/v2.0/master/text-to-video": 180,
    "kling-video/v2.0/master/image-to-video": 120,
    "runway/gen4-turbo": 150,
    "google/veo-3.1-generate": 240,
    "wan-ai/wan2.1-t2v-turbo": 90,
    "flux-pro/v1.1-ultra": 30,
    "google/imagen-4": 45,
}

# Limits
MAX_ACTIVE_GENERATIONS = 5      # Max concurrent generations per user
RATE_LIMIT_PER_MINUTE = 10      # Max generations per minute
GENERATION_TIMEOUT = 600        # Max 10 minutes


class GenerationService:
    """
    Handles the complete generation flow with:
    - Atomic credit operations
    - Idempotency protection
    - Rate limiting
    - Proper error handling
    - Event-driven notifications
    """
    
    # ========== LIMITS & VALIDATION ==========
    
    async def check_limits(self, db: AsyncSession, user_id: int):
        """
        Check all generation limits.
        Raises specific exceptions if any limit exceeded.
        """
        
        # 1. Check active generations
        active_count = await db.scalar(
            select(func.count(Generation.id)).where(
                Generation.user_id == user_id,
                Generation.status.in_([
                    GenerationStatus.PENDING,
                    GenerationStatus.PROCESSING,
                ]),
            )
        )
        
        if active_count >= MAX_ACTIVE_GENERATIONS:
            raise MaxActiveGenerationsError(MAX_ACTIVE_GENERATIONS)
        
        # 2. Check rate limit (last minute)
        one_minute_ago = datetime.utcnow() - timedelta(minutes=1)
        recent_count = await db.scalar(
            select(func.count(Generation.id)).where(
                Generation.user_id == user_id,
                Generation.created_at >= one_minute_ago,
            )
        )
        
        if recent_count >= RATE_LIMIT_PER_MINUTE:
            raise RateLimitError(retry_after=60)
    
    async def check_idempotency(
        self,
        db: AsyncSession,
        user_id: int,
        idempotency_key: Optional[str],
    ) -> Optional[Generation]:
        """
        Check if this is a duplicate request.
        Returns existing generation if duplicate, None otherwise.
        """
        if not idempotency_key:
            return None
        
        stmt = select(Generation).where(
            Generation.user_id == user_id,
            Generation.idempotency_key == idempotency_key,
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # ========== MAIN FLOW ==========
    
    async def start_generation(
        self,
        db: AsyncSession,
        request: GenerationRequest,
        idempotency_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Start a new generation request.
        
        ATOMIC FLOW:
        1. Validate user and limits
        2. Check idempotency
        3. Atomic credit deduction (with race protection)
        4. Create generation record
        5. Return immediately
        
        Background processing happens separately.
        """
        
        # 1. VALIDATE USER
        user = await db.get(User, request.user_id)
        if not user:
            raise UserNotFoundError(request.user_id)
        
        if user.is_banned:
            raise UserBannedError()
        
        # 2. CHECK LIMITS
        await self.check_limits(db, user.id)
        
        # 3. CHECK IDEMPOTENCY
        if idempotency_key:
            existing = await self.check_idempotency(db, user.id, idempotency_key)
            if existing:
                logger.info("Duplicate request detected", generation_id=existing.id)
                raise DuplicateRequestError()
        
        # 4. CALCULATE PRICE
        price = MODEL_PRICES.get(request.model_id, 10)
        
        if user.credits < price:
            raise InsufficientCreditsError(required=price, available=user.credits)
        
        # 5. ATOMIC CREDIT DEDUCTION
        # This prevents race conditions by using database-level atomic update
        stmt = (
            update(User)
            .where(
                User.id == user.id,
                User.credits >= price,  # ← CRITICAL: ensure balance still sufficient
            )
            .values(
                credits=User.credits - price,
                total_spent_credits=User.total_spent_credits + price,
                total_generations=User.total_generations + 1,
                last_active_at=datetime.utcnow(),
            )
            .returning(User.credits)
        )
        
        result = await db.execute(stmt)
        new_balance = result.scalar_one_or_none()
        
        if new_balance is None:
            # Another request beat us to it, balance insufficient now
            raise ConcurrentUpdateError()
        
        # 6. CREATE GENERATION RECORD
        generation = Generation(
            user_id=user.id,
            model_id=request.model_id,
            model_name=request.model_name,
            generation_type=request.generation_type.value,
            prompt=request.prompt,
            negative_prompt=request.negative_prompt,
            parameters=json.dumps(request.parameters) if request.parameters else None,
            credits_charged=price,
            status=GenerationStatus.PENDING,
            idempotency_key=idempotency_key,
        )
        db.add(generation)
        
        # 7. CREATE TRANSACTION RECORD (for audit)
        transaction = Transaction(
            user_id=user.id,
            type=TransactionType.GENERATION,
            amount=-price,
            reference_id=None,  # Will update after flush
            description=f"Generation: {request.model_name}",
        )
        db.add(transaction)
        
        await db.flush()
        transaction.reference_id = generation.id
        await db.commit()
        
        logger.info(
            "Generation created",
            generation_id=generation.id,
            user_id=user.id,
            model=request.model_id,
            price=price,
            new_balance=new_balance,
        )
        
        # 8. RETURN RESPONSE
        estimated_time = GENERATION_TIMES.get(request.model_id, 120)
        
        return {
            "id": generation.id,
            "status": GenerationStatus.PENDING.value,
            "message": "Генерация началась! Результат придёт в Telegram.",
            "credits_charged": price,
            "estimated_time": estimated_time,
            "new_balance": new_balance,
        }
    
    # ========== BACKGROUND PROCESSING ==========
    
    async def process_generation(
        self,
        db: AsyncSession,
        generation_id: int,
        on_started: Optional[Callable] = None,
        on_completed: Optional[Callable] = None,
        on_failed: Optional[Callable] = None,
    ):
        """
        Process the actual generation (called by background worker).
        
        Uses callback pattern for notifications to decouple from Telegram.
        
        FLOW:
        1. Get generation
        2. Update to PROCESSING
        3. Call AIML API
        4. Wait for result
        5. Update to COMPLETED/FAILED
        6. Trigger callbacks (notifications)
        7. Handle refunds if needed
        """
        
        # 1. GET GENERATION
        generation = await db.get(Generation, generation_id)
        if not generation:
            logger.error("Generation not found", generation_id=generation_id)
            return
        
        # Idempotency: skip if already processed
        if generation.status != GenerationStatus.PENDING:
            logger.warning(
                "Generation already processed",
                generation_id=generation_id,
                current_status=generation.status.value,
            )
            return
        
        # 2. UPDATE TO PROCESSING
        generation.status = GenerationStatus.PROCESSING
        generation.started_at = datetime.utcnow()
        await db.commit()
        
        logger.info("Generation processing started", generation_id=generation_id)
        
        # 3. NOTIFY USER (via callback)
        if on_started:
            try:
                estimated_time = GENERATION_TIMES.get(generation.model_id, 120)
                await on_started(
                    user_id=generation.user_id,
                    model_name=generation.model_name,
                    estimated_time=estimated_time,
                )
            except Exception as e:
                logger.error("Notification failed (on_started)", error=str(e))
                # Continue anyway - notification failure shouldn't break generation
        
        try:
            # 4. PARSE PARAMETERS
            params = json.loads(generation.parameters) if generation.parameters else {}
            
            # 5. CALL AIML API
            if generation.generation_type == "image":
                result = await aiml_client.generate_image(
                    model=generation.model_id,
                    prompt=generation.prompt,
                    negative_prompt=generation.negative_prompt,
                    **params,
                )
                
                # Image generation is synchronous
                result_url = result.get("data", [{}])[0].get("url")
                
            else:  # video
                # Start async video generation
                result = await aiml_client.generate_video(
                    model=generation.model_id,
                    prompt=generation.prompt,
                    **params,
                )
                
                task_id = result.get("id") or result.get("task_id")
                if not task_id:
                    raise Exception("No task_id in AIML response")
                
                generation.aiml_task_id = task_id
                await db.commit()
                
                # Wait for completion (with timeout)
                final_result = await aiml_client.wait_for_video(
                    task_id,
                    max_wait=GENERATION_TIMEOUT,
                )
                
                result_url = (
                    final_result.get("video", {}).get("url") or
                    final_result.get("output", {}).get("video_url") or
                    final_result.get("result_url")
                )
            
            if not result_url:
                raise Exception("No result URL in AIML response")
            
            # 6. UPDATE TO COMPLETED
            generation.status = GenerationStatus.COMPLETED
            generation.result_url = result_url
            generation.completed_at = datetime.utcnow()
            await db.commit()
            
            logger.info(
                "Generation completed successfully",
                generation_id=generation.id,
                user_id=generation.user_id,
                duration=(generation.completed_at - generation.started_at).total_seconds(),
            )
            
            # 7. NOTIFY USER (via callback)
            if on_completed:
                try:
                    await on_completed(
                        user_id=generation.user_id,
                        result_url=result_url,
                        model_name=generation.model_name,
                        prompt=generation.prompt,
                        generation_type=generation.generation_type,
                        generation_id=generation.id,
                    )
                except Exception as e:
                    logger.error("Notification failed (on_completed)", error=str(e))
            
        except TimeoutError as e:
            # TIMEOUT HANDLING
            await self._handle_generation_failure(
                db,
                generation,
                error=GenerationTimeoutError(GENERATION_TIMEOUT),
                on_failed=on_failed,
            )
            
        except Exception as e:
            # GENERIC ERROR HANDLING
            logger.error(
                "Generation failed",
                generation_id=generation.id,
                error=str(e),
                error_type=type(e).__name__,
            )
            
            await self._handle_generation_failure(
                db,
                generation,
                error=e,
                on_failed=on_failed,
            )
    
    async def _handle_generation_failure(
        self,
        db: AsyncSession,
        generation: Generation,
        error: Exception,
        on_failed: Optional[Callable] = None,
    ):
        """
        Handle generation failure with refund.
        Centralized error handling logic.
        """
        
        # Update generation status
        generation.status = GenerationStatus.FAILED
        generation.error_message = str(error)
        generation.completed_at = datetime.utcnow()
        
        # Refund credits (atomic)
        user = await db.get(User, generation.user_id)
        if user:
            user.credits += generation.credits_charged
            
            # Create refund transaction (audit trail)
            refund = Transaction(
                user_id=user.id,
                type=TransactionType.REFUND,
                amount=generation.credits_charged,
                reference_id=generation.id,
                description=f"Refund for failed generation #{generation.id}",
            )
            db.add(refund)
        
        await db.commit()
        
        logger.info(
            "Generation failed, credits refunded",
            generation_id=generation.id,
            user_id=generation.user_id,
            credits_refunded=generation.credits_charged,
        )
        
        # Notify user (via callback)
        if on_failed:
            try:
                error_code = getattr(error, 'code', 'INTERNAL_ERROR')
                user_message = getattr(error, 'user_message', 'Произошла ошибка')
                
                await on_failed(
                    user_id=generation.user_id,
                    model_name=generation.model_name,
                    error_message=user_message,
                    error_code=error_code,
                    credits_refunded=generation.credits_charged,
                )
            except Exception as e:
                logger.error("Notification failed (on_failed)", error=str(e))
    
    # ========== CANCELLATION ==========
    
    async def cancel_generation(
        self,
        db: AsyncSession,
        generation_id: int,
        user_id: int,
    ) -> Dict[str, Any]:
        """
        Cancel a pending/processing generation.
        Refunds credits if not yet completed.
        """
        
        generation = await db.get(Generation, generation_id)
        if not generation:
            raise GenerationNotFoundError(generation_id)
        
        # Verify ownership
        if generation.user_id != user_id:
            raise PermissionError("Not your generation")
        
        # Can only cancel pending/processing
        if generation.status not in [GenerationStatus.PENDING, GenerationStatus.PROCESSING]:
            raise ValueError(f"Cannot cancel {generation.status.value} generation")
        
        # Update status
        old_status = generation.status
        generation.status = GenerationStatus.CANCELLED
        generation.completed_at = datetime.utcnow()
        generation.error_message = "Cancelled by user"
        
        # Refund credits (atomic)
        user = await db.get(User, user_id)
        if user:
            user.credits += generation.credits_charged
            
            refund = Transaction(
                user_id=user.id,
                type=TransactionType.REFUND,
                amount=generation.credits_charged,
                reference_id=generation.id,
                description=f"Refund for cancelled generation #{generation.id}",
            )
            db.add(refund)
        
        await db.commit()
        
        logger.info(
            "Generation cancelled",
            generation_id=generation_id,
            user_id=user_id,
            old_status=old_status.value,
            credits_refunded=generation.credits_charged,
        )
        
        return {
            "id": generation.id,
            "status": "cancelled",
            "credits_refunded": generation.credits_charged,
            "new_balance": user.credits,
        }
    
    # ========== UTILITY ==========
    
    async def get_generation_status(
        self,
        db: AsyncSession,
        generation_id: int,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Get generation status.
        Optionally verify ownership.
        """
        generation = await db.get(Generation, generation_id)
        if not generation:
            raise GenerationNotFoundError(generation_id)
        
        if user_id and generation.user_id != user_id:
            raise PermissionError("Not your generation")
        
        return {
            "id": generation.id,
            "status": generation.status.value,
            "result_url": generation.result_url,
            "error_message": generation.error_message,
            "credits_charged": generation.credits_charged,
            "created_at": generation.created_at.isoformat(),
            "started_at": generation.started_at.isoformat() if generation.started_at else None,
            "completed_at": generation.completed_at.isoformat() if generation.completed_at else None,
        }


# Singleton
generation_service_improved = GenerationService()
