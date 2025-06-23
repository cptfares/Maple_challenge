import React, { useState, useEffect } from 'react';
import VoiceChat from './VoiceChat.jsx';

const API_BASE = '/api';

function App() {
  const [url, setUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(1);
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [isScrapingLoading, setIsScrapingLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState(null);
  const [currentMode, setCurrentMode] = useState('scrape');
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [scrapedSites, setScrapedSites] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState('all');

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsScrapingLoading(true);
    setScrapeStatus(null);

    try {
      const response = await fetch(`${API_BASE}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          max_depth: parseInt(maxDepth)
        }),
      });

      const data = await response.json();

      if (data.success) {
        setScrapeStatus('success');
        setScrapedData(data);
        
        // Fetch updated sites info
        const sitesResponse = await fetch(`${API_BASE}/sites`);
        const sitesData = await sitesResponse.json();
        setScrapedSites(sitesData);
        setUrl(''); // Clear the input
      } else {
        setScrapeStatus('error');
      }
    } catch (error) {
      console.error('Scraping error:', error);
      setScrapeStatus('error');
    } finally {
      setIsScrapingLoading(false);
    }
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsChatLoading(true);

    const userMessage = { 
      type: 'user', 
      content: question,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Check if it's a structure query
      const isStructureQuery = question.toLowerCase().includes('how many') || 
                              question.toLowerCase().includes('structure') ||
                              question.toLowerCase().includes('sitemap') ||
                              question.toLowerCase().includes('external links') ||
                              question.toLowerCase().includes('api endpoints') ||
                              question.toLowerCase().includes('domains');

      const endpoint = isStructureQuery ? '/query/structure' : '/chat';
      
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question,
          top_k: 5
        }),
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage = {
          type: 'assistant',
          content: data.answer,
          sources: data.sources || [],
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage = {
          type: 'error',
          content: 'I encountered an error processing your question. Please try again.',
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        type: 'error',
        content: 'Network error occurred. Please try again.',
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
      setQuestion('');
    }
  };

  // Fetch scraped sites on component mount
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const response = await fetch(`${API_BASE}/sites`);
        const data = await response.json();
        setScrapedSites(data);
      } catch (error) {
        console.error('Error fetching sites:', error);
      }
    };
    fetchSites();
  }, []);

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div className="app">
      <header className="app-header enhanced-header">
        <div className="header-gradient">
          <div className="header-main">
            <h1 className="main-title">Enhanced Website Chat Assistant</h1>
            <p className="subtitle">Multi-site analysis, structural queries, and intelligent content discovery</p>
          </div>
          {(currentMode === 'chat' || currentMode === 'voice') && (
            <div className="header-nav-row">
              <button
                className="back-btn header-back-btn"
                onClick={() => setCurrentMode('scrape')}
              >
                ← Back to Knowledge Base
              </button>
              <span className="section-title">Enhanced Knowledge Assistant</span>
            </div>
          )}
        </div>
      </header>

      <div className="app-content">
        {currentMode === 'scrape' ? (
          <section className="scrape-mode">
            <div className="mode-header">
              <h2>Multi-Site Knowledge Base</h2>
              <p>Add websites to build your comprehensive knowledge base</p>
            </div>

            {/* Multi-site overview */}
            {(scrapedData || (scrapedSites && scrapedSites.total_sites > 0)) && (
              <div className="mode-selection">
                <h3>Knowledge Base Ready - Choose Interaction Mode:</h3>
                <div className="mode-buttons">
                  <button
                    onClick={() => setCurrentMode('chat')}
                    className="mode-btn chat-btn"
                  >
                    <div className="mode-icon">💬</div>
                    <div className="mode-content">
                      <h4>Enhanced Chat</h4>
                      <span>Multi-site queries, structure analysis, content discovery</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setCurrentMode('voice')}
                    className="mode-btn talk-btn"
                  >
                    <div className="mode-icon">🎙️</div>
                    <div className="mode-content">
                      <h4>Voice Assistant</h4>
                      <span>Conversational AI with knowledge base access</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
            {scrapedSites && scrapedSites.total_sites > 0 && (
              <div className="sites-overview">
                <h3>Active Knowledge Base ({scrapedSites.total_sites} websites)</h3>
                <div className="sites-grid">
                  {Object.entries(scrapedSites.sites).map(([domain, info]) => (
                    <div key={domain} className="site-card">
                      <div className="site-header">
                        <h4>{domain}</h4>
                        <span className="site-status">Active</span>
                      </div>
                      <div className="site-stats">
                        <div className="stat">
                          <span className="stat-number">{info.total_pages}</span>
                          <span className="stat-label">Pages</span>
                        </div>
                        <div className="stat">
                          <span className="stat-number">{info.structure.total_api_endpoints}</span>
                          <span className="stat-label">APIs</span>
                        </div>
                        <div className="stat">
                          <span className="stat-number">{info.structure.total_images}</span>
                          <span className="stat-label">Images</span>
                        </div>
                      </div>
                      <div className="content-types">
                        {info.structure.content_types.map(type => (
                          <span key={type} className={`content-type ${type}`}>{type}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleScrape} className="scrape-form">
              <div className="input-row">
                <div className="input-group">
                  <label htmlFor="url">Website URL:</label>
                  <input
                    type="url"
                    id="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    required
                    className="url-input"
                  />
                </div>
                <div className="input-group depth-group">
                  <label htmlFor="maxDepth">Crawl Depth:</label>
                  <select
                    id="maxDepth"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(e.target.value)}
                    className="depth-select"
                  >
                    <option value={0}>Current page only</option>
                    <option value={1}>1 level deep</option>
                    <option value={2}>2 levels deep</option>
                    <option value={3}>3 levels deep</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={isScrapingLoading}
                className="scrape-btn"
              >
                {isScrapingLoading ? 'Adding to Knowledge Base...' : 'Add Website'}
              </button>
            </form>

            {scrapeStatus && (
              <div className={`status-message ${scrapeStatus}`}>
                {scrapeStatus === 'success' ? (
                  <div className="success-details">
                    <h3>Website Added Successfully!</h3>
                    <div className="scraped-info">
                      <div className="info-grid">
                        <div className="info-item">
                          <span className="info-number">{scrapedData?.pages_scraped}</span>
                          <span className="info-label">Pages Processed</span>
                        </div>
                        <div className="info-item">
                          <span className="info-number">{scrapedData?.chunks_created}</span>
                          <span className="info-label">Content Chunks</span>
                        </div>
                        <div className="info-item">
                          <span className="info-number">{scrapedData?.embeddings_stored}</span>
                          <span className="info-label">Embeddings</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p>Failed to process the website. Please verify the URL and try again.</p>
                )}
              </div>
            )}

          </section>
        ) : currentMode === 'chat' ? (
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
        ) : (
          <VoiceChat 
            onBack={() => setCurrentMode('scrape')}
            scrapedData={scrapedData}
          />
        )}
      </div>
    </div>
  );
}

export default App;