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
    try:
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
        
        logger.info("About to run cli.run_app(worker_opts)")
        # Only run the agent if 'start' is in the command-line arguments
        if len(sys.argv) > 1 and sys.argv[1] == "start":
            # Run the agent (room and token will be provided dynamically via JobContext)
            cli.run_app(worker_opts)
            logger.info("cli.run_app(worker_opts) finished")
        else:
            logger.info("No 'start' subcommand provided. Exiting.")
            print("No 'start' subcommand provided. Exiting.")
    except Exception as e:
        logger.error(f"Exception in start_voice_agent.py main(): {e}")
        import traceback
        traceback.print_exc()

# This script is no longer needed for agent startup.
# The entrypoint is now registered via livekit_agent_plugin.py for the LiveKit CLI to discover.
# You can keep this file for reference or custom local testing.

if __name__ == "__main__":
    print(">>> start_voice_agent.py is deprecated. Use the LiveKit CLI with the plugin.")