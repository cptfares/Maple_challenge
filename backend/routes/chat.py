"""
Chat endpoints for answering questions based on website content.
"""
from fastapi import APIRouter, HTTPException
from backend.models import ChatRequest, ChatResponse
from backend.services import embedding_service, vector_store, chat_service
from backend.services import scraper
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/chat", response_model=ChatResponse)
async def chat_with_content(request: ChatRequest):
    """Answer a question based on the scraped and indexed website content."""
    try:
        logger.info(f"Processing chat request: {request.question}")
        if vector_store.is_empty():
            raise HTTPException(
                status_code=400, 
                detail="No content available. Please scrape a website first using the /scrape endpoint."
            )
        question_embedding = await embedding_service.generate_embeddings([request.question])
        relevant_chunks = vector_store.search(question_embedding[0], top_k=request.top_k)
        if not relevant_chunks:
            return ChatResponse(
                success=False,
                answer="No relevant content found to answer your question.",
                sources=[],
                error="No relevant content found"
            )
        answer = await chat_service.generate_answer(request.question, relevant_chunks)
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

@router.post("/query/structure")
async def query_structure(request: ChatRequest):
    """Answer questions about website structure and metadata."""
    try:
        structure_info = scraper.get_all_scraped_sites()

        if not structure_info or not structure_info.get("sites"):
            raise ValueError("No site structure data available")

        context_lines = ["Structure Overview:"]
        context_lines.append(f"Total sites: {structure_info.get('total_sites', 0)}")

        for domain, info in structure_info["sites"].items():
            structure = info.get("structure", {})
            context_lines.append(f"\n--- {domain} ---")
            context_lines.append(f"Pages: {info.get('total_pages', 0)}")
            context_lines.append(f"Images: {structure.get('total_images', 0)}")
            context_lines.append(f"API endpoints: {structure.get('total_api_endpoints', 0)}")
            context_lines.append(f"Sitemap nodes: {len(structure.get('sitemap', []))}")

        context = "\n".join(context_lines)

        answer = await chat_service.generate_answer(
            request.question,
            [{'text': context, 'url': 'structure_summary'}]
        )

        return ChatResponse(
            success=True,
            answer=answer,
            sources=["Structure Overview"]
        )

    except Exception as e:
        logger.error(f"Structure query failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Structure query failed: {str(e)}")
