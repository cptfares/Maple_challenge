import React from 'react';

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
  setCurrentMode
}) {
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
              <div className="domain-selector">
                <label>Focus on:</label>
                <select 
                  value={selectedDomain} 
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="domain-select"
                >
                  <option value="all">All websites ({scrapedSites.total_sites})</option>
                  {Object.keys(scrapedSites.sites).map(domain => (
                    <option key={domain} value={domain}>{domain}</option>
                  ))}
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
        <div className="messages">
          {messages.length === 0 ? (
            <div className="welcome-message" style={{textAlign: 'center', color: '#666', padding: '2rem 0'}}>
              Ask anything you need to know about the knowledge base of the websites you add.
            </div>
          ) : (
            messages.map((message, index) => {
              const isUser = message.type === 'user';
              const isBot = message.type === 'assistant' || message.type === 'bot';
              return (
                <div
                  key={index}
                  className={`message message-${message.type} ${isUser ? 'align-right' : isBot ? 'align-left' : ''}`}
                  style={{
                    display: 'flex',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    alignItems: 'flex-end',
                    marginBottom: '1rem',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    width: '100%',
                  }}
                >
                  <div
                    className="message-content"
                    style={{
                      minWidth: 0,
                      flex: '1 1 0%',
                      background: isUser ? '#667eea' : '#f1f3f4',
                      color: isUser ? 'white' : '#333',
                      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '1rem',
                      maxWidth: '70%',
                      marginLeft: isUser ? 'auto' : 0,
                      marginRight: isUser ? 0 : 'auto',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      border: isUser ? 'none' : '1px solid #e1e5e9',
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <p style={{ margin: 0 }}>{message.content}</p>
                    {message.sources && message.sources.length > 0 && (
                      <div className="sources" style={{ marginTop: 8 }}>
                        <strong>Sources:</strong>{' '}
                        {message.sources.map((source, idx) => {
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
                    <span className="timestamp" style={{ fontSize: '0.8em', color: '#999', marginTop: 4, display: 'block', textAlign: isUser ? 'right' : 'left' }}>{message.timestamp}</span>
                  </div>
                </div>
              );
            })
          )}
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
