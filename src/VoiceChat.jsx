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
  const [useWebVoice, setUseWebVoice] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const audioRef = useRef(null);
  const roomRef = useRef(null);
  const wsRef = useRef(null);
  const recognitionRef = useRef(null);

  const connectToWebVoice = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Connect via WebSocket for web-based voice
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/voice`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('connected');
        setConversation(prev => [...prev, {
          id: Date.now(),
          type: 'system',
          message: 'Connected to web voice assistant'
        }]);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'assistant_response') {
          setConversation(prev => [...prev, {
            id: Date.now(),
            type: 'assistant',
            message: data.text
          }]);
          
          // Speak the response
          if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(data.text);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            speechSynthesis.speak(utterance);
            
            setIsListening(true);
            utterance.onend = () => setIsListening(false);
          }
          
          setIsProcessing(false);
        } else if (data.type === 'error') {
          setError(data.text);
          setIsProcessing(false);
        }
      };
      
      ws.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setConversation(prev => [...prev, {
          id: Date.now(),
          type: 'system',
          message: 'Disconnected from voice assistant'
        }]);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error occurred');
        setIsConnecting(false);
      };
      
      // Set up speech recognition
      if ('webkitSpeechRecognition' in window) {
        const recognition = new window.webkitSpeechRecognition();
        recognitionRef.current = recognition;
        
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onresult = (event) => {
          const transcript = event.results[event.results.length - 1][0].transcript.trim();
          if (transcript) {
            console.log('Speech recognized:', transcript);
            
            setConversation(prev => [...prev, {
              id: Date.now(),
              type: 'user',
              message: transcript
            }]);
            
            setIsProcessing(true);
            
            // Send to assistant
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'user_message',
                text: transcript
              }));
            }
          }
        };
        
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            setError('Microphone access denied. Please allow microphone access and try again.');
          }
        };
        
        recognition.onend = () => {
          if (isConnected && !isMuted) {
            setTimeout(() => {
              try {
                recognition.start();
              } catch (e) {
                console.log('Recognition restart failed:', e);
              }
            }, 100);
          }
        };
        
        // Start recognition
        recognition.start();
      } else {
        setError('Speech recognition not supported in this browser');
      }
      
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message);
      setConnectionStatus('error');
    } finally {
      setIsConnecting(false);
    }
  };

  const connectToVoiceChat = async () => {
    if (useWebVoice) {
      return await connectToWebVoice();
    }
    
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
        if (track.kind === Track.Kind.Audio && participant.identity === 'assistant') {
          const audioElement = track.attach();
          if (audioRef.current) {
            audioRef.current.appendChild(audioElement);
          }
          setIsListening(true);
          setTimeout(() => setIsListening(false), 3000); // Visual feedback
        }
      });

      livekitRoom.on('dataReceived', (payload, participant) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(payload));
          if (data.type === 'transcript' && data.text) {
            if (data.speaker === 'user') {
              setConversation(prev => [...prev, {
                id: Date.now(),
                type: 'user',
                message: data.text
              }]);
            } else if (data.speaker === 'assistant') {
              setConversation(prev => [...prev, {
                id: Date.now(),
                type: 'assistant',
                message: data.text
              }]);
            }
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
          const message = JSON.stringify({
            type: 'text_message',
            text: transcript
          });
          await livekitRoom.localParticipant.publishData(new TextEncoder().encode(message));
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
        };

        // Start recognition
        try {
          recognition.start();
          console.log('Speech recognition started');
        } catch (error) {
          console.error('Failed to start speech recognition:', error);
        }
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
    if (useWebVoice) {
      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      
      // Stop speech synthesis
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
      }
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      setIsConnected(false);
      setConnectionStatus('disconnected');
      return;
    }
    
    if (roomRef.current) {
      const roomName = roomRef.current.name;
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
    if (useWebVoice) {
      if (recognitionRef.current) {
        if (isMuted) {
          recognitionRef.current.start();
        } else {
          recognitionRef.current.stop();
        }
        setIsMuted(!isMuted);
      }
      return;
    }
    
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
            
            <div className="voice-options">
              <label className="voice-option">
                <input
                  type="radio"
                  name="voiceMode"
                  checked={useWebVoice}
                  onChange={() => setUseWebVoice(true)}
                />
                <span>Web Voice (Recommended)</span>
                <small>Uses browser speech recognition and synthesis</small>
              </label>
              <label className="voice-option">
                <input
                  type="radio"
                  name="voiceMode"
                  checked={!useWebVoice}
                  onChange={() => setUseWebVoice(false)}
                />
                <span>LiveKit Voice</span>
                <small>Requires LiveKit credentials</small>
              </label>
            </div>
            
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
                  <p>
                    {isProcessing ? 'Processing your question...' : 
                     isListening ? 'Assistant is speaking...' : 
                     isMuted ? 'Microphone muted' :
                     'Listening for your question...'}
                  </p>
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
      <div ref={audioRef} style={{ display: 'none' }}></div>
    </div>
  );
};

export default VoiceChat;