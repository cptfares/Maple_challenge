import os
import logging
from typing import List, Dict, Any
from openai import OpenAI

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(self):
        """Initialize the embedding service with OpenAI client"""
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        self.client = OpenAI(api_key=self.api_key)
        self.model = "text-embedding-3-small"  # OpenAI's embedding model
        
    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for a list of texts using OpenAI's embedding model.
        Processes in batches to handle large amounts of text.
        
        Args:
            texts: List of text strings to embed
            
        Returns:
            List of embedding vectors (each is a list of floats)
        """
        if not texts:
            return []
        
        try:
            logger.info(f"Generating embeddings for {len(texts)} texts")
            
            # Filter out empty texts
            non_empty_texts = [text.strip() for text in texts if text.strip()]
            
            if not non_empty_texts:
                logger.warning("No non-empty texts to embed")
                return []
            
            # Process in batches to avoid token limits (max ~300k tokens per request)
            batch_size = 100  # Conservative batch size to stay under limits
            all_embeddings = []
            
            for i in range(0, len(non_empty_texts), batch_size):
                batch = non_empty_texts[i:i + batch_size]
                logger.info(f"Processing batch {i//batch_size + 1}/{(len(non_empty_texts) + batch_size - 1)//batch_size}")
                
                # OpenAI embedding API call for batch
                response = self.client.embeddings.create(
                    model=self.model,
                    input=batch
                )
                
                # Extract embeddings from response
                batch_embeddings = [data.embedding for data in response.data]
                all_embeddings.extend(batch_embeddings)
            
            logger.info(f"Successfully generated {len(all_embeddings)} embeddings in batches")
            return all_embeddings
            
        except Exception as e:
            logger.error(f"Failed to generate embeddings: {str(e)}")
            raise Exception(f"Embedding generation failed: {str(e)}")
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of the embedding vectors"""
        # text-embedding-3-small returns 1536-dimensional vectors
        return 1536
