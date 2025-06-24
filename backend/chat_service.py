import os
import logging
from typing import List, Dict, Any
from openai import OpenAI

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self):
        """Initialize the chat service with OpenAI client"""
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        self.client = OpenAI(api_key=self.api_key)
        # the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
        # do not change this unless explicitly requested by the user
        self.model = "gpt-4o"
    
    async def generate_answer(self, question: str, relevant_chunks: List[Dict[str, Any]]) -> str:
        """
        Generate an answer to the question using the relevant chunks as context.
        
        Args:
            question: The user's question
            relevant_chunks: List of relevant text chunks with metadata
            
        Returns:
            Generated answer string
        """
        try:
            # Prepare context from relevant chunks
            context_parts = []
            sources = set()
            
            for chunk in relevant_chunks:
                context_parts.append(f"Content: {chunk['text']}")
                sources.add(chunk['url'])
            
            context = "\n\n".join(context_parts)
            
            # Create the prompt
            system_prompt = """You are a helpful assistant that answers questions based on provided website content. 
Follow these guidelines:
1. Answer based only on the provided context
2. Be accurate and specific
3. If the context doesn't contain enough information to answer the question, say so
4. Provide helpful and detailed answers when possible
5. Cite specific information from the context when relevant
6. If asked about sources, mention that the information comes from the provided website content"""

            user_prompt = f"""Context from website content:
{context}

Question: {question}

Please provide a helpful and accurate answer based on the provided context."""

            # Call OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=1000,
                temperature=0.1  # Low temperature for more focused answers
            )
            
            answer = response.choices[0].message.content
            
            logger.info(f"Generated answer for question: {question[:50]}...")
            return answer
            
        except Exception as e:
            logger.error(f"Failed to generate answer: {str(e)}")
            raise Exception(f"Answer generation failed: {str(e)}")
    
    def is_structure_query(self, question: str) -> bool:
        """
        Detect if the user's question is about scraped data or structure analysis.
        Returns True if the question is about number of pages, scraping, structure, etc.
        """
        keywords = [
            'how many pages', 'pages have you scraped', 'scraped pages',
            'structure analysis', 'site structure', 'scraped data',
            'how many sites', 'how many domains', 'internal links', 'external links',
            'api endpoints', 'images', 'content types', 'structure info', 'structure information'
        ]
        q = question.lower()
        return any(kw in q for kw in keywords)
