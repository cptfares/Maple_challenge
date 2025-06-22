import asyncio
import logging
import os
from typing import Dict, Any, List
from livekit import api, rtc
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import openai, silero
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage

from vector_store import VectorStore
from embeddings import EmbeddingService

logger = logging.getLogger(__name__)

class WebsiteVoiceAssistant:
    def __init__(self, vector_store: VectorStore, embedding_service: EmbeddingService):
        self.vector_store = vector_store
        self.embedding_service = embedding_service
        self.llm = ChatOpenAI(
            model="gpt-4o",
            temperature=0.1,
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )
        
    async def get_context_for_question(self, question: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Get relevant context from the vector store for the user's question"""
        if self.vector_store.is_empty():
            return []
        
        # Generate embedding for the question
        question_embedding = await self.embedding_service.generate_embeddings([question])
        if not question_embedding:
            return []
        
        # Search for relevant chunks
        relevant_chunks = self.vector_store.search(question_embedding[0], top_k=top_k)
        return relevant_chunks
    
    async def generate_response(self, question: str) -> str:
        """Generate a conversational response about the website content"""
        try:
            # Get relevant context
            relevant_chunks = await self.get_context_for_question(question)
            
            if not relevant_chunks:
                return "I don't have any website content loaded yet. Please scrape a website first before we can chat about it."
            
            # Prepare context from relevant chunks
            context_parts = []
            sources = set()
            
            for chunk in relevant_chunks:
                context_parts.append(f"Content: {chunk['text']}")
                sources.add(chunk['url'])
            
            context = "\n\n".join(context_parts)
            
            # Create conversational prompt
            system_message = SystemMessage(content="""You are a helpful voice assistant that discusses website content with users. 
            
Guidelines:
1. Answer based only on the provided website content context
2. Be conversational, friendly, and natural in your speech
3. Keep responses concise but informative (1-3 sentences max for voice)
4. If you don't know something from the context, say so politely
5. Ask follow-up questions to keep the conversation engaging
6. Speak as if you're having a natural conversation, not reading text""")
            
            human_message = HumanMessage(content=f"""Website content context:
{context}

User question: {question}

Please provide a natural, conversational response as a voice assistant discussing this website content.""")
            
            # Get response from LLM
            response = self.llm.invoke([system_message, human_message])
            
            return response.content
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            return "I'm sorry, I encountered an error while processing your question. Could you please try again?"

async def entrypoint(ctx: JobContext):
    """LiveKit agent entrypoint"""
    logger.info("Starting Website Voice Assistant")
    
    # Initialize services (these would be shared from main app)
    vector_store = VectorStore()
    embedding_service = EmbeddingService()
    website_assistant = WebsiteVoiceAssistant(vector_store, embedding_service)
    
    # Configure the voice assistant
    async def answer_question(question: str) -> str:
        """Handle user questions about website content"""
        return await website_assistant.generate_response(question)
    
    # Set up LiveKit voice assistant
    assistant = VoiceAssistant(
        vad=silero.VAD.load(),
        stt=openai.STT(),
        llm=llm.LLM.with_function_calling(
            model="gpt-4o",
            temperature=0.1,
        ),
        tts=openai.TTS(voice="alloy"),
        chat_ctx=llm.ChatContext().append(
            role="system", 
            text="""You are a helpful voice assistant that discusses website content with users.
            You have access to scraped website content and can answer questions about it.
            Be conversational, friendly, and concise in your responses.
            If users ask about content you don't have, politely explain that you need them to scrape the website first."""
        ),
    )
    
    # Register the answer function
    @assistant.llm.ai_function()
    async def get_website_info(question: str) -> str:
        """Get information about the scraped website content"""
        return await answer_question(question)
    
    # Start the assistant
    assistant.start(ctx.room)
    
    # Keep the agent running
    await asyncio.sleep(1)
    await assistant.say("Hi! I'm your website voice assistant. I can discuss the content from any website you've scraped. What would you like to know?")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))