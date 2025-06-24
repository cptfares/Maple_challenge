"""
Scrape endpoints for website content ingestion and chunking.
"""
from fastapi import APIRouter, HTTPException
from backend.models import ScrapeRequest, ScrapeResponse
from backend.services import scraper, chunker, embedding_service, vector_store
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/scrape", response_model=ScrapeResponse)
async def scrape_website(request: ScrapeRequest):
    """Scrape website with enhanced multi-content support and structure analysis."""
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

                # Append image and API links to the content if present
                links = page.get('links', {})
                extra_info = ""
                if links.get('images'):
                    extra_info += "\nImage links found on this page:\n" + "\n".join(links['images'])
                if links.get('api'):
                    extra_info += "\nAPI links found on this page:\n" + "\n".join(links['api'])
                content_with_links = page['content'] + extra_info

                page_chunks = chunker.chunk_text(
                    content_with_links,
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
        # Save vector store to disk for voice agent
        vector_store.save_to_disk("vector_store_data")
        logger.info(f"Successfully processed {len(scraped_pages)} pages, created {len(all_chunks)} chunks and saved vector store to disk")
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

@router.get("/sites")
async def get_scraped_sites():
    """Get information about all scraped sites"""
    return scraper.get_all_scraped_sites()
