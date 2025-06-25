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
        console.log('Track subscribed:', track.kind, participant.identity);
        
        if (track.kind === Track.Kind.Audio) {
          const audioElement = track.attach();
          audioElement.autoplay = true;
          audioElement.volume = 1.0;
          
          if (audioRef.current) {
            // Clear previous audio elements
            audioRef.current.innerHTML = '';
            audioRef.current.appendChild(audioElement);
          }
          
          // Show visual feedback when assistant speaks
          if (participant.identity !== 'user') {
            setIsListening(true);
            setTimeout(() => setIsListening(false), 3000);
          }
          
          console.log('Audio element attached and configured');
        }
      });

      // Handle speech recognition
      let recognition = null;
      if ('webkitSpeechRecognition' in window) {
        recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onresult = async (event) => {
          const transcript = event.results[event.results.length - 1][0].transcript;
          console.log('Speech recognized:', transcript);
          
          // Send message to agent via data channel
          try {
            const message = JSON.stringify({
              type: 'text_message',
              text: transcript
            });
            await livekitRoom.localParticipant.publishData(new TextEncoder().encode(message));
            console.log('Message sent to agent:', transcript);
          } catch (error) {
            console.error('Error sending message:', error);
          }
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
        };

        recognition.onstart = () => {
          console.log('Speech recognition started');
        };

        recognition.onend = () => {
          console.log('Speech recognition ended, restarting...');
          if (isConnected && !isMuted) {
            try {
              recognition.start();
            } catch (error) {
              console.error('Error restarting recognition:', error);
            }
          }
        };

        // Start recognition
        try {
          recognition.start();
          console.log('Starting speech recognition...');
        } catch (error) {
          console.error('Failed to start speech recognition:', error);
        }
        
        // Store recognition for cleanup
        roomRef.current.recognition = recognition;
      }

      // Connect with token
      await livekitRoom.connect(data.url, data.token);
      
      // Enable microphone only after connected
      try {
        const tracks = await createLocalTracks({
          audio: true,
          video: false,
        });
        console.log('createLocalTracks result:', tracks);
        if (tracks && tracks.length > 0) {
          const pub = await livekitRoom.localParticipant.publishTrack(tracks[0]);
          // Store the publication ref for mute/unmute
          localAudioTrackRef.current = pub;
          console.log('Audio track publication after publish:', pub);
          // Log all possible track-related properties for debugging
          console.log('localParticipant properties:', Object.keys(livekitRoom.localParticipant));
          console.log('audioTrackPublications:', livekitRoom.localParticipant.audioTrackPublications);
          console.log('tracks:', livekitRoom.localParticipant.tracks);
          console.log('audioTracks:', livekitRoom.localParticipant.audioTracks);
        } else {
          console.error('No tracks returned from createLocalTracks.');
        }
      } catch (trackError) {
        console.error('Microphone access error:', trackError);
        // Continue without microphone for now
      }
      
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
      const roomName = roomRef.current.name;
      
      // Stop speech recognition
      if (roomRef.current.recognition) {
        roomRef.current.recognition.stop();
      }
      
      roomRef.current.disconnect();
      roomRef.current = null;
      setRoom(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      // Clean up the room on the server
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
      // Get the first audio publication
      const pubArr = Array.from(room.localParticipant.audioTrackPublications.values());
      const pub = pubArr[0];
      if (pub && pub.track) {
        // Use mute/unmute methods instead of setMuted
        if (typeof pub.track.mute === 'function' && typeof pub.track.unmute === 'function') {
          if (!isMuted) {
            await pub.track.mute();
          } else {
            await pub.track.unmute();
          }
          setIsMuted(!isMuted);
        } else {
          console.error('Track does not have mute/unmute. Track object:', pub.track);
        }
        // Also control speech recognition
        if (roomRef.current && roomRef.current.recognition) {
          const recognition = roomRef.current.recognition;
          if (!isMuted) {
            recognition.stop();
          } else {
            // Only start if not already running
            if (typeof recognition.start === 'function' && recognition && recognition._isStarted !== true) {
              try {
                recognition.start();
                recognition._isStarted = true;
              } catch (error) {
                console.error('Error starting recognition after unmute:', error);
              }
            }
          }
        }
      } else {
        console.warn('No local audio track publication available to mute/unmute.');
        if (room && room.localParticipant) {
          console.warn('audioTrackPublications:', room.localParticipant.audioTrackPublications);
        }
      }
    } else {
      console.warn('No audio track available to mute/unmute.');
      if (room && room.localParticipant) {
        console.warn('audioTrackPublications:', room.localParticipant.audioTrackPublications);
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
         ← Back to Knowledge Base
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
      
      {/* Audio playback element for assistant voice */}
      <div ref={audioRef} style={{ display: 'none' }} className="audio-container"></div>
      
      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px', 
          background: 'rgba(0,0,0,0.8)', 
          color: 'white', 
          padding: '5px', 
          fontSize: '12px',
          borderRadius: '4px'
        }}>
          Status: {connectionStatus} | Listening: {isListening ? 'Yes' : 'No'}
        </div>
      )}
    </div>
  );
};

export default VoiceChat;