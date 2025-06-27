import numpy as np
import faiss
import logging
import pickle
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class VectorStore:
    def __init__(self):
        """Initialize FAISS vector store"""
        self.index: Optional[faiss.Index] = None
        self.chunks: List[Dict[str, Any]] = []
        self.dimension = 1536  # OpenAI text-embedding-3-small dimension
        
    def _create_index(self):
        """Create a new FAISS index"""
        # Use L2 (Euclidean) distance for similarity
        self.index = faiss.IndexFlatL2(self.dimension)
        logger.info(f"Created FAISS index with dimension {self.dimension}")
    
    def add_embeddings(self, embeddings: List[List[float]], chunks: List[Dict[str, Any]]):
        """
        Add embeddings and their corresponding chunks to the vector store.
        
        Args:
            embeddings: List of embedding vectors
            chunks: List of chunk metadata corresponding to embeddings
        """
        if len(embeddings) != len(chunks):
            raise ValueError("Number of embeddings must match number of chunks")
        
        if not embeddings:
            logger.warning("No embeddings to add")
            return
        
        # Create index if it doesn't exist
        if self.index is None:
            self._create_index()
        
        # Convert embeddings to numpy array
        embeddings_array = np.array(embeddings, dtype=np.float32)
        
        # Attach embeddings to chunks before storing
        for chunk, embedding in zip(chunks, embeddings):
            chunk['embedding'] = embedding
        
        # Add to FAISS index
        self.index.add(embeddings_array)
        
        # Store chunk metadata
        self.chunks.extend(chunks)
        
        logger.info(f"Added {len(embeddings)} embeddings to vector store. Total: {len(self.chunks)}")
    
    def search(self, query_embedding: List[float], top_k: int = 10, content_type_filter: str = None, domain_filter: str = None) -> List[Dict[str, Any]]:
        """
        Search for similar chunks with enhanced filtering options.
        
        Args:
            query_embedding: The query embedding vector
            top_k: Number of top results to return
            content_type_filter: Filter by content type (text, json, image)
            domain_filter: Filter by specific domain
            
        Returns:
            List of chunks with similarity scores
        """
        if self.index is None or len(self.chunks) == 0:
            logger.warning("Vector store is empty")
            return []
        
        # Convert query to numpy array
        query_array = np.array([query_embedding], dtype=np.float32)
        
        # Search in FAISS index
        top_k = min(top_k, len(self.chunks))  # Don't search for more than available
        distances, indices = self.index.search(query_array, top_k)
        
        # Prepare results with similarity scores
        results = []
        for i, (distance, idx) in enumerate(zip(distances[0], indices[0])):
            if idx < len(self.chunks):  # Ensure valid index
                chunk = self.chunks[idx].copy()
                chunk['similarity_score'] = float(distance)  # Lower distance = higher similarity
                chunk['rank'] = i + 1
                results.append(chunk)
        
        logger.info(f"Found {len(results)} similar chunks")
        return results
    
    def clear_store(self):
        """Clear all data from the vector store"""
        self.index = None
        self.chunks = []
        logger.info("Vector store cleared")
    
    def get_size(self) -> int:
        """Get the number of stored chunks"""
        return len(self.chunks)
    
    def is_empty(self) -> bool:
        """Check if the vector store is empty"""
        return len(self.chunks) == 0
    
    def save_to_disk(self, path_prefix: str):
        """Save the FAISS index and chunks to disk"""
        if self.index is not None:
            faiss.write_index(self.index, f"{path_prefix}_index.faiss")
        with open(f"{path_prefix}_chunks.pkl", "wb") as f:
            pickle.dump(self.chunks, f)
        logger.info(f"Vector store saved to {path_prefix}_index.faiss and {path_prefix}_chunks.pkl")

    def load_from_disk(self, path_prefix: str):
        """Load the FAISS index and chunks from disk"""
        try:
            self.index = faiss.read_index(f"{path_prefix}_index.faiss")
            with open(f"{path_prefix}_chunks.pkl", "rb") as f:
                self.chunks = pickle.load(f)
            logger.info(f"Vector store loaded from {path_prefix}_index.faiss and {path_prefix}_chunks.pkl")
            logger.info(f"Loaded vector store with {len(self.chunks)} chunks")
        except Exception as e:
            logger.error(f"Failed to load vector store from disk: {e}")
            self.index = None
            self.chunks = []
    
    def get_structure_info(self) -> dict:
        """Return structure information about the stored chunks."""
        info = {
            'total_chunks': len(self.chunks),
            'content_types': {},
            'domains': {}
        }
        for chunk in self.chunks:
            # Count by content type
            ctype = chunk.get('content_type', 'unknown')
            info['content_types'][ctype] = info['content_types'].get(ctype, 0) + 1
            # Count by domain
            domain = chunk.get('domain', 'unknown')
            info['domains'][domain] = info['domains'].get(domain, 0) + 1
        return info
    
    def delete_site(self, domain: str):
        """
        Delete all chunks and embeddings for a specific domain from the vector store.
        
        Args:
            domain: The domain to delete from the store.
        """
        if not self.chunks or self.index is None:
            logger.warning("Vector store is empty or not initialized.")
            return

        # Debug: print domains before deletion
        domains_before = set()
        for chunk in self.chunks:
            domains_before.add(chunk.get('domain'))
            domains_before.add(chunk.get('source_domain'))
        logger.info(f"Domains in vector store before deletion: {domains_before}")

        # Identify indices to keep (not matching the domain in domain, source_domain, or url)
        keep_indices = [i for i, chunk in enumerate(self.chunks)
                        if (chunk.get('domain') != domain and
                            chunk.get('source_domain') != domain and
                            (not chunk.get('url') or domain not in chunk.get('url')))]
        if len(keep_indices) == len(self.chunks):
            logger.info(f"No chunks found for domain '{domain}' to delete.")
            return

        # Keep only the chunks not matching the domain
        self.chunks = [self.chunks[i] for i in keep_indices]

        # Debug: print domains after deletion
        domains_after = set()
        for chunk in self.chunks:
            domains_after.add(chunk.get('domain'))
            domains_after.add(chunk.get('source_domain'))
        logger.info(f"Domains in vector store after deletion: {domains_after}")

        # Rebuild the FAISS index with the remaining embeddings
        if self.chunks:
            valid_chunks = [chunk for chunk in self.chunks if 'embedding' in chunk]
            if len(valid_chunks) < len(self.chunks):
                logger.warning(f"Some chunks are missing 'embedding' and will be skipped during index rebuild.")
            if valid_chunks:
                embeddings = [chunk['embedding'] for chunk in valid_chunks]
                self._create_index()
                embeddings_array = np.array(embeddings, dtype=np.float32)
                self.index.add(embeddings_array)
                self.chunks = valid_chunks  # Only keep valid chunks
            else:
                logger.warning("No valid chunks with 'embedding' remain after deletion.")
                self.index = None
                self.chunks = []
        else:
            self.index = None
        logger.info(f"Deleted all data for domain '{domain}' from vector store.")
