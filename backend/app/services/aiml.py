"""
AIML API Client for AI generation
Documentation: https://docs.aimlapi.com/
"""
import httpx
import asyncio
from typing import Optional, Dict, Any
from app.config import settings
import structlog

logger = structlog.get_logger()


class AIMLClient:
    """Client for AIML API"""
    
    def __init__(self):
        self.api_key = settings.aiml_api_key
        self.base_url = settings.aiml_api_base_url
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
    
    async def generate_image(
        self,
        model: str,
        prompt: str,
        negative_prompt: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate an image using AIML API
        
        Models:
        - flux-pro/v1.1-ultra (Flux Pro)
        - google/imagen-4 (Imagen 4)
        - gpt-image-1 (GPT Image)
        """
        payload = {
            "model": model,
            "prompt": prompt,
        }
        
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt
            
        # Add optional parameters
        for key, value in kwargs.items():
            if value is not None:
                payload[key] = value
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/images/generations",
                headers=self.headers,
                json=payload,
            )
            response.raise_for_status()
            return response.json()
    
    async def generate_video(
        self,
        model: str,
        prompt: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Start video generation (async)
        
        Models:
        - kling-video/v2.0/master/text-to-video (Kling 2.6 Pro)
        - kling-video/v2.0/master/image-to-video (Kling I2V)
        - minimax-video/video-01 (Minimax)
        - runway/gen4-turbo (Runway Gen4)
        - bytedance/seedance-1-lite (Seedance)
        - google/veo-3.1-generate (Veo 3.1)
        - wan-ai/wan2.1-t2v-turbo (Wan 2.1)
        """
        payload = {
            "model": model,
            "prompt": prompt,
        }
        
        # Add optional parameters
        for key, value in kwargs.items():
            if value is not None:
                payload[key] = value
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/videos/generations",
                headers=self.headers,
                json=payload,
            )
            response.raise_for_status()
            return response.json()
    
    async def get_video_status(self, task_id: str) -> Dict[str, Any]:
        """Check video generation status"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/videos/generations/{task_id}",
                headers=self.headers,
            )
            response.raise_for_status()
            return response.json()
    
    async def wait_for_video(
        self,
        task_id: str,
        max_wait: int = 600,  # 10 minutes max
        poll_interval: int = 10,
    ) -> Dict[str, Any]:
        """
        Poll for video generation completion
        Returns result when done or raises exception on timeout/failure
        """
        elapsed = 0
        
        while elapsed < max_wait:
            result = await self.get_video_status(task_id)
            status = result.get("status", "").lower()
            
            logger.info("Video generation status", task_id=task_id, status=status)
            
            if status == "completed" or status == "succeeded":
                return result
            elif status == "failed" or status == "error":
                raise Exception(f"Generation failed: {result.get('error', 'Unknown error')}")
            
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
        
        raise TimeoutError(f"Video generation timed out after {max_wait}s")


# Singleton instance
aiml_client = AIMLClient()
