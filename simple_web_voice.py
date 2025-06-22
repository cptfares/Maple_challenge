#!/usr/bin/env python3
"""
Simplified web-based voice assistant implementation
This version uses browser speech recognition and web speech synthesis
"""
import asyncio
import logging
import os
import json
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

class WebVoiceAssistant:
    def __init__(self, vector_store, embedding_service):
        self.vector_store = vector_store
        self.embedding_service = embedding_service
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.3,
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        self.connections = set()
        
    async def get_website_context(self, question: str, top_k: int = 3) -> str:
        """Get relevant website content for the question"""
        if not self.vector_store or self.vector_store.is_empty():
            return "No website content is currently available."
        
        try:
            # Generate embedding for the question
            question_embeddings = await self.embedding_service.generate_embeddings([question])
            if not question_embeddings:
                return "Unable to process your question."
            
            # Search for relevant chunks
            relevant_chunks = self.vector_store.search(question_embeddings[0], top_k=top_k)
            
            if not relevant_chunks:
                return "No relevant content found for your question."
            
            # Format context
            context_parts = []
            sources = set()
            for chunk in relevant_chunks:
                context_parts.append(f"Content: {chunk['text'][:300]}...")
                sources.add(chunk.get('url', 'Unknown source'))
            
            context = "\n\n".join(context_parts)
            sources_text = "\nSources: " + ", ".join(list(sources)[:3])
            
            return context + sources_text
            
        except Exception as e:
            logger.error(f"Error getting website context: {str(e)}")
            return "Sorry, I encountered an error accessing the website content."

    async def generate_response(self, user_message: str) -> Dict[str, Any]:
        """Generate a response using website context"""
        try:
            # Get relevant context
            context = await self.get_website_context(user_message)
            
            # Create conversational prompt
            system_message = SystemMessage(content="""You are a helpful voice assistant that discusses website content with users.
            
Guidelines:
- Answer based only on the provided website content context
- Be conversational, friendly, and natural in your speech
- Keep responses concise but informative (2-3 sentences for voice)
- If you don't know something from the context, say so politely
- Ask follow-up questions to keep the conversation engaging
- Speak as if you're having a natural conversation, not reading text""")
            
            human_message = HumanMessage(content=f"""Website content context:
{context}

User question: {user_message}

Please provide a natural, conversational response as a voice assistant discussing this website content.""")
            
            # Get response from LLM
            response = self.llm.invoke([system_message, human_message])
            
            return {
                "success": True,
                "response": response.content,
                "context_used": bool(context and "No website content" not in context)
            }
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return {
                "success": False,
                "response": "I'm sorry, I encountered an error while processing your question. Could you please try again?",
                "context_used": False
            }

    async def add_connection(self, websocket: WebSocket):
        """Add a new WebSocket connection"""
        self.connections.add(websocket)
        
    async def remove_connection(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        self.connections.discard(websocket)
        
    async def broadcast_message(self, message: Dict[str, Any]):
        """Broadcast a message to all connected clients"""
        if self.connections:
            disconnected = set()
            for connection in self.connections:
                try:
                    await connection.send_json(message)
                except:
                    disconnected.add(connection)
            
            # Remove disconnected connections
            self.connections -= disconnected

# Global instance
web_voice_assistant = None

def set_services(vector_store, embedding_service):
    """Set the services for the web voice assistant"""
    global web_voice_assistant
    web_voice_assistant = WebVoiceAssistant(vector_store, embedding_service)
    return web_voice_assistant

def get_assistant():
    """Get the global assistant instance"""
    return web_voice_assistant