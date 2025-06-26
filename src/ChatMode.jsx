import React, { useRef, useEffect } from 'react';

// Helper to render message content with structure and images
function renderMessageContent(content) {
  const imageRegex = /(https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+\.(?:jpg|jpeg|png|gif|webp|svg|bmp))/gi;
  const parts = content.split(imageRegex);

  return parts.map((part, index) => {
    if (imageRegex.test(part)) {
      return (
        <img
          key={`img-${index}`}
          src={part}
          alt="scraped"
          style={{
            maxWidth: 200,
            maxHeight: 200,
            margin: 4,
            borderRadius: 8,
            display: 'block',
          }}
        />
      );
    } else {
      const sections = part.split(/\*\*(.*?)\*\*/g).filter(Boolean);

      return sections.map((section, idx) => {
        if (idx % 2 === 1) {
          return (
            <div key={`${index}-header-${idx}`} style={{ marginTop: '1rem' }}>
              <strong style={{ fontSize: '1.1em', color: '#4a4a4a' }}>
                {section.trim()}
              </strong>
            </div>
          );
        }

        const dashMatches = section.match(/\s*-\s+/g) || [];
        if (dashMatches.length >= 2) {
          const items = section
            .split(/\s*-\s+/)
            .map(item => item.trim())
            .filter(item => item.length > 0);

          return (
            <ul key={`${index}-list-${idx}`} style={{ paddingLeft: '1.2rem', marginTop: 4 }}>
              {items.map((item, i) => (
                <li key={`${index}-${idx}-${i}`} style={{ marginBottom: '0.4rem', lineHeight: '1.4' }}>
                  {item}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${index}-text-${idx}`} style={{ marginTop: 8, lineHeight: '1.6' }}>
            {section}
          </p>
        );
      });
    }
  });
}

function ChatMode({
  messages,
  question,
  setQuestion,
  handleChat,
  isChatLoading,
  clearMessages,
  scrapedSites,
  selectedDomain,
  setSelectedDomain,
  setCurrentMode,
  chatMode,
  setChatMode
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <section className="chat-mode">
      <div className="mode-header">
        <button
          onClick={() => setCurrentMode('scrape')}
          className="back-btn"
        >
          ← Back to Knowledge Base
        </button>
        <div className="chat-info">
          <h3>Enhanced Knowledge Assistant</h3>
          {scrapedSites && (
            <div className="chat-controls">


              <div className="chat-toggle-mode">
                <label style={{ marginRight: 8 }}>Answer about:</label>
                <select
                  value={chatMode}
                  onChange={(e) => setChatMode(e.target.value)}
                  style={{ padding: '6px', borderRadius: '6px' }}
                >
                  <option value="knowledge">Knowledge Base</option>
                  <option value="structure">Website Structure</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="chat-container">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          {messages.length > 0 && (
            <button onClick={clearMessages} className="clear-btn">Clear Chat</button>
          )}
        </div>
        
        <div
          className="messages"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1rem',
            height: '400px',
            overflowY: 'auto',
          }}
        >
          {messages.length === 0 ? (
            <div
              className="welcome-message"
              style={{
                textAlign: 'center',
                color: '#666',
                padding: '2rem 0',
              }}
            >
              Ask anything you need to know about the knowledge base or structure of the websites you add.
            </div>
          ) : (
            messages.map((message, index) => {
              const isUser = message.type === 'user';

              return (
                <div
                  key={index}
                  className={`message message-${message.type} ${isUser ? 'align-right' : 'align-left'}`}
                  style={{
                    display: 'flex',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    width: '100%',
                  }}
                >
                  <div
                    className="message-content"
                    style={{
                      background: isUser ? '#667eea' : '#f1f3f4',
                      color: isUser ? 'white' : '#333',
                      borderRadius: isUser ? '16px 16px 4px' : '16px 16px 16px 4px',
                      padding: '1rem',
                      marginLeft: isUser ? 'auto' : 0,
                      marginRight: isUser ? 0 : 'auto',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      border: isUser ? 'none' : '1px solid #e1e5e9',
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      width: 'fit-content',
                      maxWidth: '80%',
                      wordBreak: 'break-word',
                    }}
                  >
                    <p style={{ margin: 0 }}>
                      {renderMessageContent(message.content)}
                    </p>

                    {message.sources && message.sources.length > 0 && (
                      <div className="sources" style={{ marginTop: 8 }}>
                        <strong>Sources:</strong>{' '}
                        {message.sources.slice(0, 5).map((source, idx) => {
                          let url = source;
                          let label = source;
                          try {
                            url = source;
                            label = new URL(source).hostname;
                          } catch {}

                          return (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="source-link"
                              style={{
                                background: '#e3f2fd',
                                color: '#1976d2',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                marginRight: 8,
                                textDecoration: 'none',
                                fontWeight: 600,
                                fontSize: '0.95em',
                              }}
                            >
                              {label}
                            </a>
                          );
                        })}
                      </div>
                    )}

                    <span
                      className="timestamp"
                      style={{
                        fontSize: '0.8em',
                        color: '#999',
                        marginTop: 4,
                        display: 'block',
                        textAlign: isUser ? 'right' : 'left',
                      }}
                    >
                      {message.timestamp}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleChat} className="chat-input-group">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about content, structure, links, or cross-site analysis..."
            disabled={isChatLoading}
            className="chat-input"
          />
          <button
            type="submit"
            disabled={isChatLoading || !question.trim()}
            className="send-btn"
          >
            {isChatLoading ? 'Processing...' : 'Send'}
          </button>
        </form>
      </div>
    </section>
  );
}

export default ChatMode;
