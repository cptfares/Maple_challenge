import logging
import os
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
import uvicorn

from enhanced_scraper import EnhancedWebScraper
from embeddings import EmbeddingService
from chunker import TextChunker
from vector_store import VectorStore
from chat_service import ChatService
from livekit_service import LiveKitService
import simple_voice_agent

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
scraper = EnhancedWebScraper()
chunker = TextChunker()
embedding_service = EmbeddingService()
vector_store = VectorStore()
chat_service = ChatService()
livekit_service = LiveKitService()

# Set services for voice agent
simple_voice_agent.set_services(vector_store, embedding_service)

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

class VoiceRoomRequest(BaseModel):
    room_name: str = "website-chat"

class VoiceRoomResponse(BaseModel):
    success: bool
    room_name: str = None
    token: str = None
    url: str = None
    error: str = None

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Website Chat API is running", "status": "healthy"}

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_website(request: ScrapeRequest):
    """Scrape website with enhanced multi-content support and structure analysis"""
    try:
        logger.info(f"Starting scrape for {request.url} with depth {request.max_depth}")
        
        scrape_result = await scraper.scrape_website(str(request.url), request.max_depth)
        
        if not scrape_result.get('success') or not scrape_result.get('pages'):
            raise HTTPException(status_code=400, detail="No content could be scraped from the website")
        
        scraped_pages = scrape_result['pages']
        site_structure = scrape_result['structure']
        
        all_chunks = []
        
        for page in scraped_pages:
            if page.get('success', False) and page.get('content'):
                content_type = page.get('content_type', 'text')
                metadata = {
                    'source_domain': site_structure['domain'],
                    'title': page.get('title', ''),
                    'depth': page.get('depth', 0),
                    'page_url': page['url']
                }
                
                if content_type == 'json' and 'raw_data' in page:
                    metadata['json_keys'] = list(page['raw_data'].keys()) if isinstance(page['raw_data'], dict) else []
                elif content_type == 'image':
                    metadata['image_filename'] = page.get('title', '')
                
                page_chunks = chunker.chunk_text(
                    page['content'], 
                    page['url'], 
                    content_type, 
                    metadata
                )
                all_chunks.extend(page_chunks)
        
        if not all_chunks:
            raise HTTPException(status_code=400, detail="No content chunks could be created from the scraped pages")
        
        chunk_texts = [chunk['text'] for chunk in all_chunks]
        embeddings = await embedding_service.generate_embeddings(chunk_texts)
        
        if not embeddings:
            raise HTTPException(status_code=500, detail="Failed to generate embeddings")
        
        vector_store.add_embeddings(embeddings, all_chunks)
        
        logger.info(f"Successfully processed {len(scraped_pages)} pages, created {len(all_chunks)} chunks")
        
        return ScrapeResponse(
            success=True,
            message="Website scraped and indexed successfully",
            pages_scraped=len(scraped_pages),
            chunks_created=len(all_chunks),
            embeddings_stored=len(embeddings)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during scraping: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")
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
    """Get enhanced status including multi-site and structure information"""
    scraped_sites = scraper.get_all_scraped_sites()
    structure_info = vector_store.get_structure_info()
    
    return {
        "vector_store_size": vector_store.get_size(),
        "has_content": not vector_store.is_empty(),
        "voice_enabled": livekit_service.is_enabled(),
        "scraped_sites": scraped_sites,
        "structure_info": structure_info
    }

@app.get("/sites")
async def get_scraped_sites():
    """Get information about all scraped sites"""
    return scraper.get_all_scraped_sites()

@app.get("/structure/{domain}")
async def get_site_structure(domain: str):
    """Get detailed structure information for a specific domain"""
    scraped_sites = scraper.get_all_scraped_sites()
    if domain in scraped_sites['sites']:
        return scraped_sites['sites'][domain]['structure']
    else:
        raise HTTPException(status_code=404, detail=f"No data found for domain: {domain}")

@app.post("/query/structure")
async def query_structure(request: ChatRequest):
    """Answer questions about website structure and metadata"""
    try:
        # Get structure information
        scraped_sites = scraper.get_all_scraped_sites()
        structure_info = vector_store.get_structure_info()
        
        # Create context about structure
        context = f"""Structure Information:
Total scraped sites: {scraped_sites['total_sites']}
Total content chunks: {structure_info.get('total_chunks', 0)}
Content types: {', '.join(structure_info.get('content_types', {}).keys())}
Domains: {', '.join(structure_info.get('domains', {}).keys())}

Site Details:
"""
        
        for domain, site_info in scraped_sites['sites'].items():
            structure = site_info['structure']
            context += f"""
Domain: {domain}
- Total pages: {structure['total_pages']}
- Internal links: {structure['total_internal_links']}
- External links: {structure['total_external_links']}
- API endpoints: {structure['total_api_endpoints']}
- Images: {structure['total_images']}
- External domains: {', '.join(structure['external_domains'])}
"""
        
        # Generate answer using chat service
        answer = await chat_service.generate_answer(request.question, [{'text': context, 'url': 'structure_info'}])
        
        return ChatResponse(
            success=True,
            answer=answer,
            sources=["Structure Analysis"]
        )
        
    except Exception as e:
        logger.error(f"Error during structure query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Structure query failed: {str(e)}")

@app.post("/execute")
async def execute_command(command: dict):
    """Execute commands on URLs (experimental feature)"""
    try:
        command_type = command.get('type')
        url = command.get('url')
        params = command.get('params', {})
        
        if command_type == 'get_links':
            # Extract all links from a page
            scrape_result = await scraper._scrape_single_page(url)
            if scrape_result.get('success'):
                return {
                    'success': True,
                    'result': scrape_result.get('links', {}),
                    'message': f"Extracted links from {url}"
                }
                
        elif command_type == 'get_images':
            # Extract all images from a page
            scrape_result = await scraper._scrape_single_page(url)
            if scrape_result.get('success'):
                links = scrape_result.get('links', {})
                return {
                    'success': True,
                    'result': links.get('images', []),
                    'message': f"Extracted {len(links.get('images', []))} images from {url}"
                }
                
        elif command_type == 'check_api':
            # Check if URL is an API endpoint and get sample data
            if scraper._is_api_endpoint(url):
                result = await scraper._scrape_api_endpoint(url)
                return {
                    'success': True,
                    'result': result,
                    'message': f"API endpoint analysis for {url}"
                }
            else:
                return {
                    'success': False,
                    'message': f"{url} does not appear to be an API endpoint"
                }
        
        return {
            'success': False,
            'message': f"Unknown command type: {command_type}"
        }
        
    except Exception as e:
        logger.error(f"Error executing command: {str(e)}")
        return {
            'success': False,
            'message': f"Command execution failed: {str(e)}"
        }

@app.post("/voice/create-room", response_model=VoiceRoomResponse)
async def create_voice_room(request: VoiceRoomRequest):
    """Create a LiveKit room for voice chat about website content"""
    try:
        if not livekit_service.is_enabled():
            raise HTTPException(
                status_code=503, 
                detail="Voice features are not configured. Please set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL."
            )
        
        # Check if we have website content
        if vector_store.is_empty():
            raise HTTPException(
                status_code=400,
                detail="No website content available. Please scrape a website first."
            )
        
        # Create room
        room_info = await livekit_service.create_room(request.room_name)
        if not room_info:
            raise HTTPException(status_code=500, detail="Failed to create voice room")
        
        # Start the voice agent
        agent_started = await livekit_service.start_voice_agent()
        if not agent_started:
            raise HTTPException(status_code=500, detail="Failed to start voice agent")
        
        # Generate token for user
        token = await livekit_service.generate_token(request.room_name, "user")
        if not token:
            raise HTTPException(status_code=500, detail="Failed to generate access token")
        
        logger.info(f"Voice room created: {request.room_name} with agent")
        
        return VoiceRoomResponse(
            success=True,
            room_name=request.room_name,
            token=token,
            url=livekit_service.url
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating voice room: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Voice room creation failed: {str(e)}")

@app.delete("/voice/room/{room_name}")
async def delete_voice_room(room_name: str):
    """Delete a LiveKit room and stop the voice agent"""
    try:
        if not livekit_service.is_enabled():
            return {"success": False, "message": "Voice features not enabled"}
        
        # Stop the voice agent
        await livekit_service.stop_voice_agent()
        
        # Delete the room
        success = await livekit_service.delete_room(room_name)
        return {"success": success}
        
    except Exception as e:
        logger.error(f"Error deleting voice room: {str(e)}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
