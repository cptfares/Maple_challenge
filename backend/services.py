"""
Service singletons for use across routers.
"""
from backend.enhanced_scraper import EnhancedWebScraper
from backend.embeddings import EmbeddingService
from backend.chunker import TextChunker
from backend.vector_store import VectorStore
from backend.chat_service import ChatService
from backend.livekit_service import LiveKitService
import backend.simple_voice_agent as simple_voice_agent

scraper = EnhancedWebScraper()
chunker = TextChunker()
embedding_service = EmbeddingService()
vector_store = VectorStore()
chat_service = ChatService()
livekit_service = LiveKitService()

# Set services for voice agent
simple_voice_agent.set_services(vector_store, embedding_service)
