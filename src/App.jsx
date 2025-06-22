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
      <header className="app-header">
        <div className="header-content">
          <h1>Enhanced Website Chat Assistant</h1>
          <p>Multi-site analysis, structural queries, and intelligent content discovery</p>
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
              <div className="form-group">
                <label htmlFor="url">Website URL:</label>
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="maxDepth">Crawl Depth:</label>
                <select
                  id="maxDepth"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(e.target.value)}
                >
                  <option value={0}>Current page only</option>
                  <option value={1}>1 level deep</option>
                  <option value={2}>2 levels deep</option>
                  <option value={3}>3 levels deep</option>
                </select>
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
                    <div className="query-types">
                      <button 
                        className="query-type-btn"
                        onClick={() => setQuestion('How many pages are there in total?')}
                      >
                        Structure Query
                      </button>
                      <button 
                        className="query-type-btn"
                        onClick={() => setQuestion('What external domains are linked?')}
                      >
                        Link Analysis
                      </button>
                      <button 
                        className="query-type-btn"
                        onClick={() => setQuestion('What API endpoints were found?')}
                      >
                        API Discovery
                      </button>
                      <button 
                        className="query-type-btn"
                        onClick={clearMessages}
                      >
                        Clear Chat
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="chat-container">
              <div className="messages">
                {messages.length === 0 ? (
                  <div className="welcome-message">
                    <div className="capabilities-grid">
                      <div className="capability">
                        <h4>📊 Structural Analysis</h4>
                        <p>Ask about website architecture, page counts, navigation structure</p>
                        <em>"How many pages are there?" "What's the site structure?"</em>
                      </div>
                      <div className="capability">
                        <h4>🔗 Link Intelligence</h4>
                        <p>Discover external connections, API endpoints, resource links</p>
                        <em>"What external domains are linked?" "Find API endpoints"</em>
                      </div>
                      <div className="capability">
                        <h4>🌐 Multi-Site Queries</h4>
                        <p>Compare content across multiple websites in your knowledge base</p>
                        <em>"Compare these sites" "What topics overlap?"</em>
                      </div>
                      <div className="capability">
                        <h4>🖼️ Content Discovery</h4>
                        <p>Find images, documents, and multimedia resources</p>
                        <em>"What images are available?" "List downloadable content"</em>
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div key={index} className={`message ${message.type}`}>
                      <div className="message-content">
                        <p>{message.content}</p>
                        {message.sources && message.sources.length > 0 && (
                          <div className="sources">
                            <small>Sources: {message.sources.join(', ')}</small>
                          </div>
                        )}
                        <span className="timestamp">{message.timestamp}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleChat} className="chat-form">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about content, structure, links, or cross-site analysis..."
                  disabled={isChatLoading}
                />
                <button
                  type="submit"
                  disabled={isChatLoading || !question.trim()}
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