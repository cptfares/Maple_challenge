"""
Voice endpoints for LiveKit room and voice agent management.
"""
from fastapi import APIRouter, HTTPException
from backend.models import VoiceRoomRequest, VoiceRoomResponse
from backend.services import livekit_service, vector_store
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/voice/create-room", response_model=VoiceRoomResponse)
async def create_voice_room(request: VoiceRoomRequest):
    """Create a LiveKit room for voice chat about website content."""
    try:
        if not livekit_service.is_enabled():
            raise HTTPException(
                status_code=503, 
                detail="Voice features are not configured. Please set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL."
            )
        if vector_store.is_empty():
            raise HTTPException(
                status_code=400,
                detail="No website content available. Please scrape a website first."
            )
        room_info = await livekit_service.create_room(request.room_name)
        if not room_info:
            raise HTTPException(status_code=500, detail="Failed to create voice room")
        agent_started = await livekit_service.start_voice_agent(room_name=request.room_name, agent_token=room_info.get("agent_token"))
        if not agent_started:
            raise HTTPException(status_code=500, detail="Failed to start voice agent")
        token = await livekit_service.generate_token(request.room_name, "user")
        if not token:
            raise HTTPException(status_code=500, detail="Failed to generate access token")
        logger.info(f"Voice room created: {request.room_name} with agent")
        return VoiceRoomResponse(
            success=True,
            room_name=request.room_name,
            token=token,
            url=livekit_service.url
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating voice room: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Voice room creation failed: {str(e)}")

@router.delete("/voice/room/{room_name}")
async def delete_voice_room(room_name: str):
    """Delete a LiveKit room and stop the voice agent."""
    try:
        if not livekit_service.is_enabled():
            return {"success": False, "message": "Voice features not enabled"}
        await livekit_service.stop_voice_agent()
        success = await livekit_service.delete_room(room_name)
        return {"success": success}
    except Exception as e:
        logger.error(f"Error deleting voice room: {str(e)}")
        return {"success": False, "error": str(e)}
