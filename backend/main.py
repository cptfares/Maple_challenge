import logging
import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Ensure environment variables are loaded from .env
from backend import __init__

# Workaround for Playwright on Windows
if sys.platform.startswith('win'):
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Import routers from routes modules
from backend.routes.scrape import router as scrape_router
from backend.routes.chat import router as chat_router
from backend.routes.voice import router as voice_router

# Suppress asyncio NotImplementedError tracebacks for Playwright on Windows
from backend.suppress_asyncio_tracebacks import *

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Website Chat API",
    description="Chat with website content using AI",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers for modular endpoints
app.include_router(scrape_router)
app.include_router(chat_router)
app.include_router(voice_router)

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Website Chat API is running", "status": "healthy"}

# You can add additional utility endpoints here if needed (e.g., /status, /sites, /structure/{domain}, /execute)

# Load environment variables from .env at startup
try:
    from dotenv import load_dotenv
    load_dotenv()
    print('[INFO] .env loaded at startup')
except ImportError:
    print("[WARNING] python-dotenv not installed. .env file will not be loaded.")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

