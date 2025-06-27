import React, { useState, useEffect, useRef } from 'react';
import { Room, createLocalTracks, Track } from 'livekit-client';

const API_BASE = '/api';

const VoiceChat = ({ onBack, scrapedData }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [isListening, setIsListening] = useState(false);

  const audioRef = useRef(null);
  const roomRef = useRef(null);
  const localAudioTrackRef = useRef(null);

  const connectToVoiceChat = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/voice/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: `website-chat-${Date.now()}` }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create voice room');
      }

      const livekitRoom = new Room();
      roomRef.current = livekitRoom;

      livekitRoom.on('connected', () => {
        console.log('Connected to voice chat');
      });

      livekitRoom.on('disconnected', () => {
        console.log('Disconnected from voice chat');
        setIsConnected(false);
        setConnectionStatus('disconnected');
      });

      livekitRoom.on('trackSubscribed', (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.autoplay = true;
          audioElement.volume = 1.0;

          if (audioRef.current) {
            audioRef.current.innerHTML = '';
            audioRef.current.appendChild(audioElement);
          }

          if (participant.identity !== 'user') {
            setIsListening(true);
            setTimeout(() => setIsListening(false), 3000);
          }
        }
      });

      await livekitRoom.connect(data.url, data.token);

      const tracks = await createLocalTracks({ audio: true, video: false });
      if (tracks && tracks.length > 0) {
        const pub = await livekitRoom.localParticipant.publishTrack(tracks[0]);
        localAudioTrackRef.current = pub;
      }

      setRoom(livekitRoom);
      setIsConnected(true);
      setConnectionStatus('connected');
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
      const roomName = roomRef.current.name;
      roomRef.current.disconnect();
      roomRef.current = null;
      setRoom(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');

      try {
        await fetch(`${API_BASE}/voice/room/${roomName}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Error cleaning up room:', error);
      }
    }
  };

  const toggleMute = async () => {
    if (room && room.localParticipant && room.localParticipant.audioTrackPublications) {
      const pubArr = Array.from(room.localParticipant.audioTrackPublications.values());
      const pub = pubArr[0];
      if (pub && pub.track) {
        if (typeof pub.track.mute === 'function' && typeof pub.track.unmute === 'function') {
          if (!isMuted) {
            await pub.track.mute();
          } else {
            await pub.track.unmute();
          }
          setIsMuted(!isMuted);
        } else {
          console.error('Track does not support mute/unmute');
        }
      } else {
        console.warn('No local audio track publication available');
      }
    }
  };

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="voice-chat">
      <div className="voice-header">
        <button onClick={onBack} className="back-btn">← Back to Knowledge Base</button>
        <div className="voice-info">
          <h3>Voice Assistant</h3>
        </div>
      </div>

      <div className="voice-content">
        {!isConnected ? (
          <div className="voice-setup">
            <div className="voice-icon">🎙️</div>
            <h2>Voice Assistant</h2>
            <p>Connect to start a voice conversation about the website content.</p>

            {error && (
              <div className="error-message">
                <strong>Connection Error:</strong> {error}
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
              <div className={`status-indicator ${connectionStatus} ${isListening ? 'listening' : ''}`}></div>
              <span>Connected to Voice Assistant</span>
            </div>

            <div className="voice-layout" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '350px' }}>
              <div className="voice-visualization" style={{ margin: '0 auto' }}>
                <div className="voice-avatar">
                  <div className={`avatar-circle ${isListening ? 'listening' : ''}`}>
                    <span>🤖</span>
                  </div>
                  <p>{isListening ? 'Assistant is speaking...' : 'Listening for your question...'}</p>
                </div>

                <div className="voice-controls">
                  <button
                    onClick={toggleMute}
                    className={`control-btn ${isMuted ? 'muted' : ''}`}
                  >
                    {isMuted ? '🔇 Unmute' : '🎤 Mute'}
                  </button>
                  <button
                    onClick={disconnectFromVoiceChat}
                    className="control-btn disconnect"
                  >
                    📞 End Call
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div ref={audioRef} style={{ display: 'none' }} className="audio-container"></div>
    </div>
  );
};

export default VoiceChat;
