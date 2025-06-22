#!/usr/bin/env python3
"""
Standalone script to start the LiveKit voice agent
"""
import asyncio
import logging
import os
import sys
from livekit.agents import cli, WorkerOptions
from simple_voice_agent import entrypoint, set_services
from vector_store import VectorStore
from embeddings import EmbeddingService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    """Main entry point for the voice agent"""
    logger.info("Starting LiveKit voice agent...")
    
    # Initialize services (these will be shared instances)
    vector_store = VectorStore()
    embedding_service = EmbeddingService()
    
    # Set services for the agent
    set_services(vector_store, embedding_service)
    
    # Create worker options
    worker_opts = WorkerOptions(
        entrypoint_fnc=entrypoint,
        prewarm_fnc=None,
    )
    
    # Run the agent
    cli.run_app(worker_opts)

if __name__ == "__main__":
    main()