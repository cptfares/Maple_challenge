import logging
import os
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import uvicorn

from scraper import WebScraper
from embeddings import EmbeddingService
from chunker import TextChunker
from vector_store import VectorStore
from chat_service import ChatService

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

# Initialize services
scraper = WebScraper()
chunker = TextChunker()
embedding_service = EmbeddingService()
vector_store = VectorStore()
chat_service = ChatService()

# Pydantic models
class ScrapeRequest(BaseModel):
    url: HttpUrl
    max_depth: int = 2

class ScrapeResponse(BaseModel):
    success: bool
    message: str
    pages_scraped: int
    chunks_created: int
    embeddings_stored: int

class ChatRequest(BaseModel):
    question: str
    top_k: int = 5

class ChatResponse(BaseModel):
    success: bool
    answer: str
    sources: List[str]
    error: str = None

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Website Chat API is running", "status": "healthy"}

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_website(request: ScrapeRequest):
    """
    Scrape a website, extract content, create embeddings, and store in vector database.
    
    Args:
        request: Contains URL and optional max_depth parameter
        
    Returns:
        Response with scraping statistics and success status
    """
    try:
        logger.info(f"Starting to scrape website: {request.url} with depth: {request.max_depth}")
        
        # Step 1: Scrape the website
        scraped_data = await scraper.scrape_website(str(request.url), request.max_depth)
        
        if not scraped_data:
            raise HTTPException(status_code=400, detail="Failed to scrape any content from the website")
        
        logger.info(f"Scraped {len(scraped_data)} pages")
        
        # Step 2: Process and chunk the text
        all_chunks = []
        for page_data in scraped_data:
            chunks = chunker.chunk_text(page_data['content'], page_data['url'])
            all_chunks.extend(chunks)
        
        logger.info(f"Created {len(all_chunks)} text chunks")
        
        # Step 3: Generate embeddings
        embeddings = await embedding_service.generate_embeddings([chunk['text'] for chunk in all_chunks])
        
        # Step 4: Store in vector database
        vector_store.clear_store()  # Clear previous data
        vector_store.add_embeddings(embeddings, all_chunks)
        
        logger.info(f"Stored {len(embeddings)} embeddings in vector store")
        
        return ScrapeResponse(
            success=True,
            message="Website scraped and indexed successfully",
            pages_scraped=len(scraped_data),
            chunks_created=len(all_chunks),
            embeddings_stored=len(embeddings)
        )
        
    except Exception as e:
        logger.error(f"Error during scraping: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")

@app.post("/chat", response_model=ChatResponse)
async def chat_with_content(request: ChatRequest):
    """
    Answer a question based on the scraped and indexed website content.
    
    Args:
        request: Contains the user's question and optional top_k parameter
        
    Returns:
        AI-generated answer with source references
    """
    try:
        logger.info(f"Processing chat request: {request.question}")
        
        # Check if vector store has data
        if vector_store.is_empty():
            raise HTTPException(
                status_code=400, 
                detail="No content available. Please scrape a website first using the /scrape endpoint."
            )
        
        # Step 1: Generate embedding for the question
        question_embedding = await embedding_service.generate_embeddings([request.question])
        
        # Step 2: Search for relevant chunks
        relevant_chunks = vector_store.search(question_embedding[0], top_k=request.top_k)
        
        if not relevant_chunks:
            return ChatResponse(
                success=False,
                answer="No relevant content found to answer your question.",
                sources=[],
                error="No relevant content found"
            )
        
        # Step 3: Generate answer using chat service
        answer = await chat_service.generate_answer(request.question, relevant_chunks)
        
        # Extract unique sources
        sources = list(set([chunk['url'] for chunk in relevant_chunks]))
        
        logger.info(f"Generated answer using {len(relevant_chunks)} relevant chunks")
        
        return ChatResponse(
            success=True,
            answer=answer,
            sources=sources
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

@app.get("/status")
async def get_status():
    """Get the current status of the vector store"""
    return {
        "vector_store_size": vector_store.get_size(),
        "has_content": not vector_store.is_empty()
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
