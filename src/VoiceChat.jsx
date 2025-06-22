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
  const [isListening, setIsListening] = useState(false);
  const [conversation, setConversation] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  
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
        setConversation(prev => [...prev, {
          id: Date.now(),
          type: 'system',
          message: 'Connected to AI assistant. You can start speaking!'
        }]);
      });
      
      livekitRoom.on('disconnected', () => {
        console.log('Disconnected from voice chat');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setConversation(prev => [...prev, {
          id: Date.now(),
          type: 'system',
          message: 'Disconnected from voice assistant'
        }]);
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

      livekitRoom.on('dataReceived', (payload, participant) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(payload));
          console.log('Data received:', data);
          
          if (data.type === 'assistant_response' && data.text) {
            setConversation(prev => [...prev, {
              id: Date.now(),
              type: 'assistant',
              message: data.text
            }]);
          }
        } catch (e) {
          console.error('Error parsing data:', e);
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
          
          // Add user message to conversation
          setConversation(prev => [...prev, {
            id: Date.now(),
            type: 'user',
            message: transcript
          }]);

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
      
      // Enable microphone
      try {
        const tracks = await createLocalTracks({
          audio: true,
          video: false,
        });
        
        if (tracks && tracks.length > 0) {
          await livekitRoom.localParticipant.publishTrack(tracks[0]);
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
    if (room && room.localParticipant) {
      const audioTrack = room.localParticipant.getTrack(Track.Source.Microphone);
      if (audioTrack) {
        await audioTrack.setMuted(!isMuted);
        setIsMuted(!isMuted);
        
        // Also control speech recognition
        if (roomRef.current && roomRef.current.recognition) {
          if (!isMuted) {
            // About to mute - stop recognition
            roomRef.current.recognition.stop();
          } else {
            // About to unmute - start recognition
            try {
              roomRef.current.recognition.start();
            } catch (error) {
              console.error('Error starting recognition after unmute:', error);
            }
          }
        }
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
              <div className={`status-indicator ${connectionStatus} ${isListening ? 'listening' : ''}`}></div>
              <span>Connected to Voice Assistant</span>
            </div>
            
            <div className="voice-layout">
              <div className="voice-visualization">
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
                    {isMuted ? '🔇' : '🎤'} {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                  
                  <button
                    onClick={disconnectFromVoiceChat}
                    className="control-btn disconnect"
                  >
                    📞 End Call
                  </button>
                </div>
              </div>

              <div className="conversation-panel">
                <div className="conversation-header">
                  <h4>Conversation</h4>
                  <span className="content-info">{scrapedData?.chunks_created} chunks available</span>
                </div>
                
                <div className="conversation-messages">
                  {conversation.length === 0 ? (
                    <div className="conversation-empty">
                      <p>Start speaking to begin your conversation about the website content</p>
                    </div>
                  ) : (
                    conversation.map((item) => (
                      <div key={item.id} className={`conversation-item ${item.type}`}>
                        <div className="message-content">
                          {item.type === 'user' && <span className="speaker">You:</span>}
                          {item.type === 'assistant' && <span className="speaker">AI:</span>}
                          {item.type === 'system' && <span className="speaker">System:</span>}
                          <span className="message-text">{item.message}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="conversation-footer">
                  <p>💬 Speak naturally about the website content</p>
                  <p>🎯 Ask questions, request summaries, or discuss specific topics</p>
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