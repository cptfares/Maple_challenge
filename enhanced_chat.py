from fastapi import APIRouter, HTTPException
from .chat_service import chat_service
from .vector_store import vector_store
from .embeddings import embedding_service
from .models import ChatRequest, ChatResponse
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_with_content(request: ChatRequest):
    """
    Answer a question based on the scraped and indexed website content.
    """
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
