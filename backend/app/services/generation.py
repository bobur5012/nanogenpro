"""
Generation Service - Orchestrates the generation flow
"""
import json
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models import User, Generation, GenerationStatus, Transaction, TransactionType
from app.schemas.generation import GenerationRequest, GenerationType
from app.services.aiml import aiml_client
from app.services.telegram import telegram_service
from app.config import settings
import structlog

logger = structlog.get_logger()


# Model pricing map (in credits/diamonds)
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


class GenerationService:
    """Handles the complete generation flow"""
    
    async def start_generation(
        self,
        db: AsyncSession,
        request: GenerationRequest,
    ) -> Dict[str, Any]:
        """
        Start a new generation request
        
        1. Validate user and balance
        2. Deduct credits
        3. Create generation record
        4. Start async generation
        5. Return response to Web App
        """
        
        # 1. Get user
        user = await db.get(User, request.user_id)
        if not user:
            raise ValueError("User not found")
        
        if user.is_banned:
            raise ValueError("User is banned")
        
        # 2. Calculate price
        price = MODEL_PRICES.get(request.model_id, 10)
        
        if user.credits < price:
            raise ValueError(f"Insufficient balance. Need {price} 💎, have {user.credits} 💎")
        
        # 3. Deduct credits
        user.credits -= price
        user.total_spent_credits += price
        user.total_generations += 1
        user.last_active_at = datetime.utcnow()
        
        # 4. Create generation record
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
        )
        db.add(generation)
        
        # 5. Create transaction record
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
            "Generation started",
            generation_id=generation.id,
            user_id=user.id,
            model=request.model_id,
            price=price,
        )
        
        # 6. Return response (actual generation happens in background)
        estimated_time = GENERATION_TIMES.get(request.model_id, 120)
        
        return {
            "id": generation.id,
            "status": GenerationStatus.PENDING.value,
            "message": "Генерация началась! Результат придёт в Telegram.",
            "credits_charged": price,
            "estimated_time": estimated_time,
            "new_balance": user.credits,
        }
    
    async def process_generation(
        self,
        db: AsyncSession,
        generation_id: int,
    ):
        """
        Process the actual generation (called by background worker)
        
        1. Get generation record
        2. Call AIML API
        3. Wait for completion
        4. Send result to Telegram
        5. Handle errors and refunds
        """
        
        # 1. Get generation
        generation = await db.get(Generation, generation_id)
        if not generation:
            logger.error("Generation not found", generation_id=generation_id)
            return
        
        if generation.status != GenerationStatus.PENDING:
            logger.warning("Generation already processed", generation_id=generation_id)
            return
        
        # Update status
        generation.status = GenerationStatus.PROCESSING
        generation.started_at = datetime.utcnow()
        await db.commit()
        
        # Notify user
        estimated_time = GENERATION_TIMES.get(generation.model_id, 120)
        await telegram_service.send_generation_started(
            user_id=generation.user_id,
            model_name=generation.model_name,
            estimated_time=estimated_time,
        )
        
        try:
            # 2. Parse parameters
            params = json.loads(generation.parameters) if generation.parameters else {}
            
            # 3. Call AIML API
            if generation.generation_type == "image":
                result = await aiml_client.generate_image(
                    model=generation.model_id,
                    prompt=generation.prompt,
                    negative_prompt=generation.negative_prompt,
                    **params,
                )
                
                # Image generation is usually synchronous
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
                    raise Exception("No task_id in response")
                
                generation.aiml_task_id = task_id
                await db.commit()
                
                # Wait for completion
                final_result = await aiml_client.wait_for_video(task_id)
                result_url = (
                    final_result.get("video", {}).get("url") or
                    final_result.get("output", {}).get("video_url") or
                    final_result.get("result_url")
                )
            
            if not result_url:
                raise Exception("No result URL in response")
            
            # 4. Update generation record
            generation.status = GenerationStatus.COMPLETED
            generation.result_url = result_url
            generation.completed_at = datetime.utcnow()
            await db.commit()
            
            # 5. Send result to user via Telegram
            await telegram_service.send_generation_result(
                user_id=generation.user_id,
                result_url=result_url,
                model_name=generation.model_name,
                prompt=generation.prompt,
                generation_type=generation.generation_type,
                generation_id=generation.id,
            )
            
            logger.info(
                "Generation completed",
                generation_id=generation.id,
                user_id=generation.user_id,
            )
            
        except Exception as e:
            logger.error(
                "Generation failed",
                generation_id=generation.id,
                error=str(e),
            )
            
            # Update status
            generation.status = GenerationStatus.FAILED
            generation.error_message = str(e)
            generation.completed_at = datetime.utcnow()
            
            # Refund credits
            user = await db.get(User, generation.user_id)
            if user:
                user.credits += generation.credits_charged
                
                # Create refund transaction
                refund = Transaction(
                    user_id=user.id,
                    type=TransactionType.REFUND,
                    amount=generation.credits_charged,
                    reference_id=generation.id,
                    description=f"Refund for failed generation #{generation.id}",
                )
                db.add(refund)
                
                generation.status = GenerationStatus.REFUNDED
            
            await db.commit()
            
            # Notify user
            await telegram_service.send_generation_error(
                user_id=generation.user_id,
                model_name=generation.model_name,
                error_message="Произошла ошибка при генерации. Попробуйте ещё раз.",
                credits_refunded=generation.credits_charged,
            )


# Singleton
generation_service = GenerationService()
