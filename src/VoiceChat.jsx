import React, { useState, useEffect, useRef } from 'react';
import { Room, connect, createLocalTracks, Track } from 'livekit-client';

const API_BASE = '/api';

const VoiceChat = ({ onBack, scrapedData }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  const audioRef = useRef(null);
  const roomRef = useRef(null);

  const connectToVoiceChat = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Create voice room
      const response = await fetch(`${API_BASE}/voice/create-room`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: `website-chat-${Date.now()}`
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to create voice room');
      }

      // Connect to LiveKit room
      const livekitRoom = new Room();
      roomRef.current = livekitRoom;
      
      // Set up room event handlers
      livekitRoom.on('connected', () => {
        console.log('Connected to voice chat');
        setIsConnected(true);
        setConnectionStatus('connected');
      });
      
      livekitRoom.on('disconnected', () => {
        console.log('Disconnected from voice chat');
        setIsConnected(false);
        setConnectionStatus('disconnected');
      });
      
      livekitRoom.on('trackSubscribed', (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio && participant.identity === 'assistant') {
          const audioElement = track.attach();
          if (audioRef.current) {
            audioRef.current.appendChild(audioElement);
          }
        }
      });

      // Connect with token
      await livekitRoom.connect(data.url, data.token);
      
      // Enable microphone
      const tracks = await createLocalTracks({
        audio: true,
        video: false,
      });
      
      await livekitRoom.localParticipant.publishTrack(tracks[0]);
      setRoom(livekitRoom);
      
    } catch (err) {
      console.error('Voice connection error:', err);
      setError(err.message);
      setConnectionStatus('error');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectFromVoiceChat = async () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
      setRoom(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
    }
  };

  const toggleMute = async () => {
    if (room && room.localParticipant) {
      const audioTrack = room.localParticipant.getTrack(Track.Source.Microphone);
      if (audioTrack) {
        await audioTrack.setMuted(!isMuted);
        setIsMuted(!isMuted);
      }
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="voice-chat">
      <div className="voice-header">
        <button onClick={onBack} className="back-btn">
          ← Back to Chat
        </button>
        <div className="voice-info">
          <h3>Voice Assistant</h3>
          <p>Talk about: {scrapedData?.pages_scraped} pages from the website</p>
        </div>
      </div>

      <div className="voice-content">
        {!isConnected ? (
          <div className="voice-setup">
            <div className="voice-icon">🎙️</div>
            <h2>Voice Assistant</h2>
            <p>
              Connect to start a voice conversation about the website content.
              The AI assistant can discuss and answer questions about what was scraped.
            </p>
            
            {error && (
              <div className="error-message">
                <strong>Connection Error:</strong> {error}
                {error.includes('not configured') && (
                  <div className="setup-hint">
                    <p>To enable voice features, you need to:</p>
                    <ol>
                      <li>Set up a LiveKit server or use LiveKit Cloud</li>
                      <li>Add LIVEKIT_API_KEY and LIVEKIT_API_SECRET to your environment</li>
                    </ol>
                  </div>
                )}
              </div>
            )}
            
            <button
              onClick={connectToVoiceChat}
              disabled={isConnecting}
              className="connect-btn"
            >
              {isConnecting ? 'Connecting...' : 'Start Voice Chat'}
            </button>
          </div>
        ) : (
          <div className="voice-active">
            <div className="connection-status">
              <div className={`status-indicator ${connectionStatus}`}></div>
              <span>Connected to Voice Assistant</span>
            </div>
            
            <div className="voice-visualization">
              <div className="voice-avatar">
                <div className="avatar-circle">
                  <span>🤖</span>
                </div>
                <p>AI Assistant is listening...</p>
              </div>
            </div>
            
            <div className="voice-controls">
              <button
                onClick={toggleMute}
                className={`control-btn ${isMuted ? 'muted' : ''}`}
              >
                {isMuted ? '🔇' : '🎤'} {isMuted ? 'Unmute' : 'Mute'}
              </button>
              
              <button
                onClick={disconnectFromVoiceChat}
                className="control-btn disconnect"
              >
                📞 End Call
              </button>
            </div>
            
            <div className="voice-instructions">
              <p>💬 Just speak naturally to ask questions about the website content</p>
              <p>🎯 The assistant has access to all {scrapedData?.chunks_created} content chunks</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Audio playback element for assistant voice */}
      <div ref={audioRef} style={{ display: 'none' }}></div>
    </div>
  );
};

export default VoiceChat;