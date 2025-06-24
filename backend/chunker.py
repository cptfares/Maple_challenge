import tiktoken
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class TextChunker:
    def __init__(self, max_tokens: int = 500, overlap_tokens: int = 50):
        """
        Initialize the text chunker.
        
        Args:
            max_tokens: Maximum tokens per chunk
            overlap_tokens: Number of overlapping tokens between chunks
        """
        self.max_tokens = max_tokens
        self.overlap_tokens = overlap_tokens
        self.encoding = tiktoken.get_encoding("cl100k_base")  # GPT-4 encoding
    
    def _count_tokens(self, text: str) -> int:
        """Count the number of tokens in a text string"""
        return len(self.encoding.encode(text))
    
    def _split_by_sentences(self, text: str) -> List[str]:
        """Split text by sentences, preserving sentence boundaries"""
        import re
        
        # Split by sentence endings but keep the delimiter
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def chunk_text(self, text: str, source_url: str, content_type: str = 'text', metadata: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """
        Split text into chunks with enhanced metadata support.
        
        Args:
            text: The text to chunk
            source_url: The source URL for reference
            content_type: Type of content (text, json, image, etc.)
            metadata: Additional metadata about the content
            
        Returns:
            List of chunk dictionaries with enhanced metadata
        """
        if not text or not text.strip():
            return []
        
        # Clean the text
        text = text.strip()
        
        # If text is already small enough, return as single chunk
        token_count = self._count_tokens(text)
        if token_count <= self.max_tokens:
            return [{
                'text': text,
                'tokens': token_count,
                'url': source_url,
                'chunk_id': 0
            }]
        
        # Split into sentences for better chunking
        sentences = self._split_by_sentences(text)
        
        chunks = []
        current_chunk = []
        current_tokens = 0
        chunk_id = 0
        
        for sentence in sentences:
            sentence_tokens = self._count_tokens(sentence)
            
            # If single sentence exceeds max tokens, split it further
            if sentence_tokens > self.max_tokens:
                # Save current chunk if it has content
                if current_chunk:
                    chunk_text = ' '.join(current_chunk)
                    chunks.append({
                        'text': chunk_text,
                        'tokens': self._count_tokens(chunk_text),
                        'url': source_url,
                        'chunk_id': chunk_id
                    })
                    chunk_id += 1
                    current_chunk = []
                    current_tokens = 0
                
                # Split long sentence by words
                words = sentence.split()
                word_chunk = []
                word_tokens = 0
                
                for word in words:
                    word_token_count = self._count_tokens(word + ' ')
                    
                    if word_tokens + word_token_count > self.max_tokens and word_chunk:
                        # Save word chunk
                        chunk_text = ' '.join(word_chunk)
                        chunks.append({
                            'text': chunk_text,
                            'tokens': self._count_tokens(chunk_text),
                            'url': source_url,
                            'chunk_id': chunk_id
                        })
                        chunk_id += 1
                        word_chunk = []
                        word_tokens = 0
                    
                    word_chunk.append(word)
                    word_tokens += word_token_count
                
                # Save remaining words
                if word_chunk:
                    chunk_text = ' '.join(word_chunk)
                    chunks.append({
                        'text': chunk_text,
                        'tokens': self._count_tokens(chunk_text),
                        'url': source_url,
                        'chunk_id': chunk_id
                    })
                    chunk_id += 1
                
                continue
            
            # Check if adding this sentence would exceed the limit
            if current_tokens + sentence_tokens > self.max_tokens and current_chunk:
                # Save current chunk
                chunk_text = ' '.join(current_chunk)
                chunks.append({
                    'text': chunk_text,
                    'tokens': self._count_tokens(chunk_text),
                    'url': source_url,
                    'chunk_id': chunk_id
                })
                chunk_id += 1
                
                # Start new chunk with overlap
                if self.overlap_tokens > 0 and len(current_chunk) > 1:
                    # Keep last few sentences for overlap
                    overlap_text = ' '.join(current_chunk[-2:])  # Last 2 sentences
                    overlap_tokens = self._count_tokens(overlap_text)
                    
                    if overlap_tokens <= self.overlap_tokens:
                        current_chunk = current_chunk[-2:]
                        current_tokens = overlap_tokens
                    else:
                        current_chunk = [current_chunk[-1]]  # Just last sentence
                        current_tokens = self._count_tokens(current_chunk[0])
                else:
                    current_chunk = []
                    current_tokens = 0
            
            current_chunk.append(sentence)
            current_tokens += sentence_tokens
        
        # Save final chunk
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunks.append({
                'text': chunk_text,
                'tokens': self._count_tokens(chunk_text),
                'url': source_url,
                'chunk_id': chunk_id
            })
        
        logger.info(f"Split text from {source_url} into {len(chunks)} chunks")
        return chunks
