import asyncio
import logging
import os
import json
from typing import Dict, Any, List, Optional
from livekit import api, rtc
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm, stt, tts, vad
from livekit.plugins import openai, silero
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)

class WebsiteVoiceAgent:
    def __init__(self, vector_store, embedding_service):
        self.vector_store = vector_store
        self.embedding_service = embedding_service
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.3,
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
    async def get_website_context(self, question: str, top_k: int = 3) -> str:
        """Get relevant website content for the question"""
        if self.vector_store.is_empty():
            return "No website content is currently loaded."
        
        try:
            # Generate embedding for the question
            question_embedding = await self.embedding_service.generate_embeddings([question])
            if not question_embedding:
                return "Unable to search website content."
            
            # Search for relevant chunks
            relevant_chunks = self.vector_store.search(question_embedding[0], top_k=top_k)
            
            if not relevant_chunks:
                return "No relevant content found for your question."
            
            # Format context
            context_parts = []
            for chunk in relevant_chunks:
                context_parts.append(f"From {chunk['url']}: {chunk['text'][:300]}...")
            
            return "\n\n".join(context_parts)
            
        except Exception as e:
            logger.error(f"Error getting website context: {str(e)}")
            return "Error retrieving website content."

# Global references for the agent
vector_store_ref = None
embedding_service_ref = None

def set_services(vector_store, embedding_service):
    """Set the services for the voice agent"""
    global vector_store_ref, embedding_service_ref
    vector_store_ref = vector_store
    embedding_service_ref = embedding_service

async def entrypoint(ctx: JobContext):
    """LiveKit agent entrypoint for voice assistant"""
    logger.info("Starting Website Voice Assistant Agent")
    
    # Initialize the website voice agent
    agent = WebsiteVoiceAgent(vector_store_ref, embedding_service_ref)
    
    # Create LLM with function calling
    llm_instance = openai.LLM(model="gpt-4o", temperature=0.3)
    
    # Define the website info function
    @llm_instance.ai_function()
    async def get_website_info(question: str) -> str:
        """Get information from the scraped website content based on the user's question"""
        return await agent.get_website_context(question)
    
    # Create assistant with components
    assistant_vad = silero.VAD.load()
    assistant_stt = openai.STT()
    assistant_tts = openai.TTS(voice="alloy")
    
    # Initialize chat context
    chat_ctx = llm.ChatContext().append(
        role="system",
        text="""You are a helpful voice assistant that discusses website content with users.
        
Key guidelines:
- You have access to scraped website content through the get_website_info function
- Always use the function to get relevant content before answering questions
- Be conversational, friendly, and natural in your speech
- Keep responses concise but informative (2-3 sentences for voice)
- If asked about content not in the website, politely explain the limitation
- Ask follow-up questions to keep the conversation engaging
- Speak naturally as if having a real conversation"""
    )
    
    # Create a simple voice assistant manually
    class SimpleVoiceAssistant:
        def __init__(self, room, vad, stt, llm, tts, chat_ctx):
            self.room = room
            self.vad = vad
            self.stt = stt
            self.llm = llm
            self.tts = tts
            self.chat_ctx = chat_ctx
            self.active = False
            
        async def start(self):
            self.active = True
            # Listen for participants
            self.room.on("participant_connected", self._on_participant_connected)
            self.room.on("track_subscribed", self._on_track_subscribed)
            
        async def _on_participant_connected(self, participant):
            if participant.identity != "agent":
                await self.say_greeting()
                
        async def _on_track_subscribed(self, track, publication, participant):
            if track.kind == rtc.TrackKind.KIND_AUDIO and participant.identity != "agent":
                # Process audio for speech-to-text
                await self._process_audio_track(track, participant)
                
        async def _process_audio_track(self, track, participant):
            # This would process audio and convert to text
            # For now, we'll simulate the conversation
            pass
            
        async def say_greeting(self):
            if vector_store_ref and not vector_store_ref.is_empty():
                greeting = f"Hi! I'm your website voice assistant. I have access to content from {vector_store_ref.get_size()} text chunks. What would you like to know about the website?"
            else:
                greeting = "Hi! I'm your website voice assistant. It looks like no website content is loaded yet. Please scrape a website first, then we can chat about its content."
            
            await self.say(greeting)
            
        async def say(self, text):
            # Generate speech and publish as audio track
            audio_data = await self.tts.synthesize(text)
            # Create audio track and publish (simplified)
            logger.info(f"Assistant says: {text}")
    
    # Create and start the assistant
    assistant = SimpleVoiceAssistant(
        ctx.room, assistant_vad, assistant_stt, llm_instance, assistant_tts, chat_ctx
    )
    
    await assistant.start()
    
    # Wait for the session to continue
    while True:
        await asyncio.sleep(1)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))