"""
Generation API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.generation import GenerationRequest, GenerationResponse
from app.services.generation import generation_service
from app.services.user import user_service
from app.schemas.user import TelegramUser
import structlog

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
    
    Flow:
    1. Validate user and balance
    2. Deduct credits
    3. Return immediately with generation ID
    4. Process generation in background
    5. Send result via Telegram when done
    """
    try:
        # TODO: Verify Telegram init_data signature
        # For now, we trust the user_id
        
        # Start generation (deducts credits, creates record)
        result = await generation_service.start_generation(db, request)
        
        # Process generation in background
        background_tasks.add_task(
            process_generation_background,
            generation_id=result["id"],
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Generation start failed", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")


async def process_generation_background(generation_id: int):
    """Background task to process generation"""
    from app.database import AsyncSessionLocal
    
    async with AsyncSessionLocal() as db:
        try:
            await generation_service.process_generation(db, generation_id)
        except Exception as e:
            logger.error(
                "Background generation failed",
                generation_id=generation_id,
                error=str(e),
            )


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
