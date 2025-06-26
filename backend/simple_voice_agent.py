#!/usr/bin/env python3
"""
Simplified voice agent that integrates with website content
"""
import asyncio
import logging
import os
import json
from typing import Dict, Any, List, Optional
from livekit import api, rtc
from livekit.agents import Agent, AgentSession, JobContext, function_tool
from livekit.plugins import openai, silero
from backend.vector_store import VectorStore
from backend.embeddings import EmbeddingService

# Use the shared services set by set_services
vector_store = None
embedding_service = None

VECTOR_STORE_PATH_PREFIX = os.getenv("VECTOR_STORE_PATH_PREFIX", "vector_store_data")

def set_services(vs, es):
    global vector_store, embedding_service
    vector_store = vs
    embedding_service = es

# Load from disk if not set
if vector_store is None:
    vector_store = VectorStore()
    vector_store.load_from_disk(VECTOR_STORE_PATH_PREFIX)
if embedding_service is None:
    embedding_service = EmbeddingService()

logger = logging.getLogger(__name__)

async def get_website_context(question: str, top_k: int = 5):
    # Always reload the vector store from disk to get the latest data
    global vector_store
    vector_store.load_from_disk(VECTOR_STORE_PATH_PREFIX)
    logger.info(f"get_website_context called with question: {question}")
    print(f"get_website_context called with question: {question}")
    if not vector_store:
        logger.error("Vector store is not set. Did you call set_services?")
        return "No website content is currently available."
    if not embedding_service:
        logger.error("Embedding service is not set. Did you call set_services?")
        return "No website content is currently available."
    if vector_store.is_empty():
        logger.warning("Vector store is empty.")
        return "No website content is currently available."
    try:
        question_embedding = await embedding_service.generate_embeddings([question])
        logger.info(f"Generated embedding for question: {question} -> {question_embedding}")
        if not question_embedding:
            logger.warning("Failed to generate embeddings for the question.")
            return "Unable to process your question."
        relevant_chunks = vector_store.search(question_embedding[0], top_k=top_k)
        logger.info(f"Relevant chunks found: {relevant_chunks}")
        if not relevant_chunks:
            logger.info("No relevant content found for the question.")
            return "No relevant content found for your question."
        # Format context like chat_service.py
        context_parts = []
        sources = set()
        for chunk in relevant_chunks:
            context_parts.append(f"Content: {chunk['text']}")
            if 'url' in chunk:
                sources.add(chunk['url'])
        context = "\n\n".join(context_parts)
        return context
    except Exception as e:
        logger.error(f"Error getting website context: {str(e)}")
        import traceback
        traceback.print_exc()
        return f"Error: {str(e)}"

@function_tool
async def lookup_website_content(question: str):
    """
    Use this tool to answer ANY user question about the website. 
    This tool returns the most relevant content from the website for the given question.
    """
    logger.info(f"lookup_website_content triggered with question: {question}")
    print(f"lookup_website_content triggered with question: {question}")
    context = await get_website_context(question)
    logger.info(f"Context returned: {context}")
    print(f"Context returned: {context}")
    return context  # Return a string, not a dict

async def entrypoint(ctx: JobContext):
    logger.info(">>> entrypoint() called in simple_voice_agent.py")
    print(">>> entrypoint() called in simple_voice_agent.py")
    try:
        await ctx.connect()
        # Log the registered tools and their schemas
        tool_list = [lookup_website_content]
        logger.info(f"Registering tools: {[t.__name__ for t in tool_list]}")
        for t in tool_list:
            logger.info(f"Tool {t.__name__} doc: {t.__doc__}")
        agent = Agent(
            instructions=(
                "You are a friendly, helpful, and polite voice assistant for a website analysis tool.\n"
                "Your job is to help users understand the content of a website they have scraped.\n"
                "\n"
                "Behavior:\n"
                "- Greet the user only at the **start** of the conversation.\n"
                "- For **every** user question, call the `lookup_website_content` tool.\n"
                "- After calling the tool, use the returned content to answer the user's question clearly and concisely.\n"
                "- If the tool returns no relevant content or says it's unavailable, respond politely and explain that the answer wasn't found.\n"
                "- Do **not** make up information. Only respond using what was returned from the website content.\n"
                "\n"
                "Tone:\n"
                "- Be friendly and easy to understand.\n"
                "- Avoid repeating greetings.\n"
                "- Avoid long-winded answers. Be concise, but informative.\n"
                "\n"
                "Never say anything that wasn't based on the tool result.\n"
                "If the answer is unclear, ask the user to rephrase or clarify."
                        ),
            tools=tool_list,
        )
        session = AgentSession(
            vad=silero.VAD.load(),
            stt=openai.STT(),
            llm=openai.LLM(model="gpt-4o-mini"),
            tts=openai.TTS(voice="alloy"),
        )
        await session.start(agent=agent, room=ctx.room)
        logger.info("Agent session started.")
        print("Agent session started.")
    except Exception as e:
        logger.error(f"Exception in entrypoint: {e}")
        import traceback
        traceback.print_exc()
        print(f"Exception in entrypoint: {e}")

if __name__ == "__main__":
    import sys
    from livekit.agents import cli, WorkerOptions
    if len(sys.argv) > 1 and sys.argv[1] == "start":
        cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
    elif len(sys.argv) > 1 and sys.argv[1] == "dev":
        cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint), dev=True)
    elif len(sys.argv) > 1 and sys.argv[1] == "console":
        cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint), console=True)
    else:
        print("Usage: python simple_voice_agent.py [start|dev|console]")