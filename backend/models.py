from pydantic import BaseModel, HttpUrl
from typing import List

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
