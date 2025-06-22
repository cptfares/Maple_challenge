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
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.plugins import openai
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

class WebsiteVoiceBot:
    def __init__(self, vector_store, embedding_service):
        self.vector_store = vector_store
        self.embedding_service = embedding_service
        self.openai_client = ChatOpenAI(
            model="gpt-4o",
            temperature=0.3,
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
    async def get_website_context(self, question: str) -> str:
        """Get relevant website content for the question"""
        if not self.vector_store or self.vector_store.is_empty():
            return "No website content is currently available."
        
        try:
            # Generate embedding for the question
            question_embeddings = await self.embedding_service.generate_embeddings([question])
            if not question_embeddings:
                return "Unable to process your question."
            
            # Search for relevant chunks
            relevant_chunks = self.vector_store.search(question_embeddings[0], top_k=3)
            
            if not relevant_chunks:
                return "No relevant content found for your question."
            
            # Format context
            context_parts = []
            for chunk in relevant_chunks:
                context_parts.append(f"From the website: {chunk['text'][:200]}...")
            
            return "\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Error getting website context: {str(e)}")
            return "Sorry, I encountered an error accessing the website content."

    async def generate_response(self, user_message: str) -> str:
        """Generate a response using website context"""
        try:
            # Get relevant context
            context = await self.get_website_context(user_message)
            
            # Create prompt
            system_prompt = """You are a helpful voice assistant discussing website content. 
            Be conversational, friendly, and keep responses to 2-3 sentences since this is voice interaction.
            Use the provided context to answer questions accurately."""
            
            user_prompt = f"""Context from website: {context}
            
            User question: {user_message}
            
            Please provide a helpful, conversational response."""
            
            # Get response from OpenAI
            response = self.openai_client.invoke([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ])
            
            return response.content
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return "I'm sorry, I encountered an error processing your request."

# Global references
bot_instance = None

def set_services(vector_store, embedding_service):
    """Set the services for the voice bot"""
    global bot_instance
    bot_instance = WebsiteVoiceBot(vector_store, embedding_service)

async def entrypoint(ctx: JobContext):
    """Main entrypoint for the voice agent"""
    logger.info("Starting simple voice agent")
    
    if not bot_instance:
        logger.error("Bot instance not initialized")
        return
    
    room = ctx.room
    
    # TTS for responses
    tts = openai.TTS(voice="alloy")
    
    async def handle_message(message_text: str, participant: rtc.RemoteParticipant):
        """Handle incoming text message and respond with voice"""
        logger.info(f"Received message: {message_text}")
        
        # Generate response
        response = await bot_instance.generate_response(message_text)
        logger.info(f"Generated response: {response}")
        
        # Convert to speech
        try:
            audio_data = await tts.synthesize(response)
            
            # Create audio track
            audio_source = rtc.AudioSource(sample_rate=24000, num_channels=1)
            audio_track = rtc.LocalAudioTrack.create_audio_track("assistant_voice", audio_source)
            
            # Publish the track
            await room.local_participant.publish_track(audio_track)
            
            # Stream the audio data
            await audio_source.capture_frame(audio_data)
            
        except Exception as e:
            logger.error(f"Error with TTS: {str(e)}")
    
    # Handle data messages (text from frontend)
    @room.on("data_received")
    def on_data_received(data: bytes, participant: rtc.RemoteParticipant):
        try:
            message = json.loads(data.decode())
            if message.get("type") == "text_message":
                # Handle the message asynchronously
                asyncio.create_task(handle_message(message.get("text", ""), participant))
        except Exception as e:
            logger.error(f"Error processing data: {str(e)}")
    
    # Send greeting when participant joins
    @room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        if participant.identity != "agent":
            # Send greeting
            if bot_instance.vector_store and not bot_instance.vector_store.is_empty():
                greeting = f"Hello! I can answer questions about the website content. I have access to {bot_instance.vector_store.get_size()} pieces of information."
            else:
                greeting = "Hello! Please scrape a website first so I can answer questions about its content."
            
            asyncio.create_task(handle_message("Hello", participant))
    
    logger.info("Voice agent is ready and waiting for participants")
    
    # Keep the agent running
    while True:
        await asyncio.sleep(1)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))