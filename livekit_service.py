import os
import asyncio
import logging
import subprocess
import signal
from typing import Optional
from livekit import api
import aiohttp

logger = logging.getLogger(__name__)

class LiveKitService:
    def __init__(self):
        self.api_key = os.getenv("LIVEKIT_API_KEY")
        self.api_secret = os.getenv("LIVEKIT_API_SECRET") 
        self.url = os.getenv("LIVEKIT_URL", "wss://your-livekit-server.com")
        self.agent_process = None
        
        if not self.api_key or not self.api_secret:
            logger.warning("LiveKit credentials not found. Voice features will be disabled.")
            self.enabled = False
        else:
            self.enabled = True
            
    async def create_room(self, room_name: str) -> Optional[dict]:
        """Create a new LiveKit room for voice chat"""
        if not self.enabled:
            return None
        lkapi = api.LiveKitAPI(self.url, self.api_key, self.api_secret)
        try:
            room_service = lkapi.room
            room = await room_service.create_room(
                api.CreateRoomRequest(
                    name=room_name,
                    empty_timeout=300,  # 5 minutes
                    max_participants=2,  # User + AI assistant
                )
            )
            logger.info(f"Created LiveKit room: {room_name}")
            # Generate agent token
            agent_token = await self.generate_token(room_name, "agent")
            return {
                "room_name": room.name,
                "url": self.url,
                "created": True,
                "agent_token": agent_token
            }
        except Exception as e:
            logger.error(f"Failed to create LiveKit room: {str(e)}")
            return None
        finally:
            await lkapi.aclose()
    
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
        lkapi = api.LiveKitAPI(self.url, self.api_key, self.api_secret)
        try:
            room_service = lkapi.room
            await room_service.delete_room(api.DeleteRoomRequest(room=room_name))
            logger.info(f"Deleted LiveKit room: {room_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete LiveKit room: {str(e)}")
            return False
        finally:
            await lkapi.aclose()
    
    async def start_voice_agent(self, room_name=None, agent_token=None) -> bool:
        """Start the LiveKit voice agent"""
        if not self.enabled:
            return False
        try:
            # Stop existing agent if running
            await self.stop_voice_agent()
            # Set environment variables for the agent
            env = os.environ.copy()
            env["LIVEKIT_API_KEY"] = self.api_key
            env["LIVEKIT_API_SECRET"] = self.api_secret
            env["LIVEKIT_URL"] = self.url
            if room_name:
                env["AGENT_ROOM_NAME"] = room_name
            if agent_token:
                env["AGENT_TOKEN"] = agent_token
            # Start the voice agent process (show logs in console)
            self.agent_process = subprocess.Popen(
                ["python", "simple_voice_agent.py", "start"],
                env=env
            )
            logger.info("Voice agent started successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to start voice agent: {str(e)}")
            return False
    
    async def stop_voice_agent(self) -> bool:
        """Stop the LiveKit voice agent"""
        if self.agent_process:
            try:
                self.agent_process.terminate()
                await asyncio.sleep(1)
                if self.agent_process.poll() is None:
                    self.agent_process.kill()
                self.agent_process = None
                logger.info("Voice agent stopped")
                return True
            except Exception as e:
                logger.error(f"Error stopping voice agent: {str(e)}")
                return False
        return True
    
    def is_enabled(self) -> bool:
        """Check if LiveKit service is properly configured"""
        return self.enabled