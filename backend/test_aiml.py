import asyncio
import os
from dotenv import load_dotenv
from app.services.aiml import aiml_client
import structlog

# Load env
load_dotenv()

logger = structlog.get_logger()

async def test_generation():
    print(f"Testing AIML API with Key: {os.getenv('AIML_API_KEY')[:5]}...")
    
    try:
        # Test Image Generation (Cheaper/Faster)
        print("Sending request to AIML API (Flux Pro)...")
        result = await aiml_client.generate_image(
            model="openai/gpt-image-1-5",
            prompt="A futuristic nanotech robot scanning a circuit board, cinematic lighting, 8k"
        )
        print("✅ Generation Success!")
        print(f"Result: {result}")
        return True
    except Exception as e:
        print(f"❌ Generation Failed: {e}")
        if hasattr(e, 'response'):
             print(f"Response: {e.response.text}")
        return False

if __name__ == "__main__":
    asyncio.run(test_generation())
