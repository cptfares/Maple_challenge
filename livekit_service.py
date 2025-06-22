import os
import asyncio
import logging
from typing import Optional
from livekit import api
import aiohttp

logger = logging.getLogger(__name__)

class LiveKitService:
    def __init__(self):
        self.api_key = os.getenv("LIVEKIT_API_KEY")
        self.api_secret = os.getenv("LIVEKIT_API_SECRET") 
        self.url = os.getenv("LIVEKIT_URL", "wss://your-livekit-server.com")
        
        if not self.api_key or not self.api_secret:
            logger.warning("LiveKit credentials not found. Voice features will be disabled.")
            self.enabled = False
        else:
            self.enabled = True
            
    async def create_room(self, room_name: str) -> Optional[dict]:
        """Create a new LiveKit room for voice chat"""
        if not self.enabled:
            return None
            
        try:
            # Create room using LiveKit API
            room_service = api.RoomService(self.url, self.api_key, self.api_secret)
            
            room = await room_service.create_room(
                api.CreateRoomRequest(
                    name=room_name,
                    empty_timeout=300,  # 5 minutes
                    max_participants=2,  # User + AI assistant
                )
            )
            
            logger.info(f"Created LiveKit room: {room_name}")
            return {
                "room_name": room.name,
                "url": self.url,
                "created": True
            }
            
        except Exception as e:
            logger.error(f"Failed to create LiveKit room: {str(e)}")
            return None
    
    async def generate_token(self, room_name: str, participant_name: str) -> Optional[str]:
        """Generate access token for a participant"""
        if not self.enabled:
            return None
            
        try:
            token = api.AccessToken(self.api_key, self.api_secret) \
                .with_identity(participant_name) \
                .with_name(participant_name) \
                .with_grants(api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish=True,
                    can_subscribe=True,
                )).to_jwt()
            
            return token
            
        except Exception as e:
            logger.error(f"Failed to generate LiveKit token: {str(e)}")
            return None
    
    async def delete_room(self, room_name: str) -> bool:
        """Delete a LiveKit room"""
        if not self.enabled:
            return False
            
        try:
            room_service = api.RoomService(self.url, self.api_key, self.api_secret)
            await room_service.delete_room(api.DeleteRoomRequest(room=room_name))
            logger.info(f"Deleted LiveKit room: {room_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete LiveKit room: {str(e)}")
            return False
    
    def is_enabled(self) -> bool:
        """Check if LiveKit service is properly configured"""
        return self.enabled