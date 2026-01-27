"""
Generation API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.generation import GenerationRequest, GenerationResponse
from app.services.generation import generation_service
from app.services.user import user_service
from app.services.telegram import telegram_service
from app.schemas.user import TelegramUser
from app.config import settings
import structlog
from datetime import datetime

logger = structlog.get_logger()
router = APIRouter(prefix="/api/generation", tags=["Generation"])


@router.post("/start", response_model=dict)
async def start_generation(
    request: GenerationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Start a new generation request from Web App
    
    IMPROVED Flow:
    1. Validate user, limits, idempotency
    2. Atomic credit deduction (race-safe)
    3. Return immediately with generation ID
    4. Process generation in background with fallback
    5. Send result via Telegram when done
    """
    try:
        # Verify Telegram init_data signature
        from app.services.telegram import telegram_service
        
        if request.init_data:
            is_valid = telegram_service.verify_init_data(
                init_data=request.init_data,
                user_id=request.user_id
            )
            if not is_valid:
                logger.warning(
                    "Invalid init_data signature",
                    user_id=request.user_id,
                )
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": "INVALID_SIGNATURE",
                        "message": "Недействительная подпись Telegram WebApp",
                    }
                )
        else:
            logger.warning("No init_data provided", user_id=request.user_id)
            # In production, reject requests without init_data
            # For development, allow but log warning
            if not settings.debug:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "MISSING_INIT_DATA",
                        "message": "Требуется init_data от Telegram WebApp",
                    }
                )
        
        # Extract idempotency key from request (if provided)
        idempotency_key = getattr(request, 'idempotency_key', None)
        
        # Start generation (atomic, with all validations)
        result = await generation_service.start_generation(
            db, 
            request,
            idempotency_key=idempotency_key,
        )
        
        # Process generation in background with fallback protection
        background_tasks.add_task(
            process_generation_background,
            generation_id=result["id"],
        )
        
        return result
        
    except Exception as e:
        # Handle custom exceptions with proper HTTP codes
        if hasattr(e, 'http_status') and hasattr(e, 'code'):
            raise HTTPException(
                status_code=e.http_status,
                detail={
                    "code": e.code,
                    "message": e.user_message if hasattr(e, 'user_message') else str(e),
                }
            )
        
        # Generic errors
        logger.error("Generation start failed", error=str(e), error_type=type(e).__name__)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Внутренняя ошибка сервера",
            }
        )


async def process_generation_background(generation_id: int):
    """
    Background task to process generation.
    
    IMPROVED: Fallback protection for data loss prevention.
    """
    from app.database import AsyncSessionLocal
    from app.models import Generation, GenerationStatus, User, Transaction, TransactionType
    
    async with AsyncSessionLocal() as db:
        try:
            await generation_service.process_generation(db, generation_id)
            
        except Exception as e:
            logger.error(
                "Background task crashed",
                generation_id=generation_id,
                error=str(e),
                error_type=type(e).__name__,
            )
            
            # ========== FALLBACK: Emergency refund ==========
            # Prevents data loss if background task crashes
            try:
                async with AsyncSessionLocal() as fallback_db:
                    gen = await fallback_db.get(Generation, generation_id)
                    
                    if gen and gen.status in [GenerationStatus.PENDING, GenerationStatus.PROCESSING]:
                        # Mark as failed
                        gen.status = GenerationStatus.FAILED
                        gen.error_message = "Internal server error (background task crashed)"
                        gen.completed_at = datetime.utcnow()
                        
                        # Refund credits
                        user = await fallback_db.get(User, gen.user_id)
                        if user:
                            user.credits += gen.credits_charged
                            
                            refund = Transaction(
                                user_id=user.id,
                                type=TransactionType.REFUND,
                                amount=gen.credits_charged,
                                reference_id=generation_id,
                                description=f"Emergency refund for crashed generation #{generation_id}",
                            )
                            fallback_db.add(refund)
                        
                        await fallback_db.commit()
                        
                        logger.info(
                            "Emergency refund completed",
                            generation_id=generation_id,
                            credits_refunded=gen.credits_charged,
                        )
                        
                        # Try to notify user
                        try:
                            from app.services.telegram import telegram_service
                            await telegram_service.send_generation_error(
                                user_id=gen.user_id,
                                model_name=gen.model_name,
                                error_message="Внутренняя ошибка сервера. Кредиты возвращены.",
                                credits_refunded=gen.credits_charged,
                            )
                        except:
                            pass  # Notification failure is not critical
                            
            except Exception as fallback_error:
                logger.critical(
                    "CRITICAL: Emergency refund failed!",
                    generation_id=generation_id,
                    error=str(fallback_error),
                )
                # TODO: Send alert to admin Telegram channel


@router.get("/status/{generation_id}")
async def get_generation_status(
    generation_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get generation status"""
    from app.models import Generation
    
    generation = await db.get(Generation, generation_id)
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    return {
        "id": generation.id,
        "status": generation.status.value,
        "result_url": generation.result_url,
        "error_message": generation.error_message,
        "created_at": generation.created_at.isoformat(),
        "completed_at": generation.completed_at.isoformat() if generation.completed_at else None,
    }


@router.post("/cancel/{generation_id}")
async def cancel_generation(
    generation_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Cancel a pending/processing generation.
    Refunds credits.
    """
    try:
        result = await generation_service.cancel_generation(db, generation_id, user_id)
        return result
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if hasattr(e, 'http_status'):
            raise HTTPException(
                status_code=e.http_status,
                detail={"code": getattr(e, 'code', 'ERROR'), "message": str(e)}
            )
        raise HTTPException(status_code=500, detail="Internal error")


@router.get("/history/{user_id}")
async def get_generation_history(
    user_id: int,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Get user's generation history"""
    from sqlalchemy import select, desc
    from app.models import Generation
    
    stmt = (
        select(Generation)
        .where(Generation.user_id == user_id)
        .order_by(desc(Generation.created_at))
        .limit(limit)
        .offset(offset)
    )
    
    result = await db.execute(stmt)
    generations = result.scalars().all()
    
    return {
        "items": [
            {
                "id": g.id,
                "model_name": g.model_name,
                "prompt": g.prompt[:100] + "..." if len(g.prompt) > 100 else g.prompt,
                "status": g.status.value,
                "credits_charged": g.credits_charged,
                "created_at": g.created_at.isoformat(),
                "result_url": g.result_url,
            }
            for g in generations
        ],
        "total": len(generations),
    }
