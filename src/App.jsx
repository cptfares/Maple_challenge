import React, { useState } from 'react';
import VoiceChat from './VoiceChat.jsx';

const API_BASE = '/api';

function App() {
  const [url, setUrl] = useState('');
  const [depth, setDepth] = useState(2);
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [isScrapingLoading, setIsScrapingLoading] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [scrapedData, setScrapedData] = useState(null);
  const [currentMode, setCurrentMode] = useState('scrape'); // 'scrape', 'chat', or 'voice'
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsScrapingLoading(true);
    setScrapeStatus(null);
    setScrapeProgress(0);
    setScrapedData(null);

    // Simulate progress bar animation
    const progressInterval = setInterval(() => {
      setScrapeProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 500);

    try {
      const response = await fetch(`${API_BASE}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url.trim(),
          max_depth: depth
        }),
      });

      const data = await response.json();
      clearInterval(progressInterval);
      setScrapeProgress(100);

      if (data.success) {
        setScrapedData(data);
        setScrapeStatus({
          type: 'success',
          message: `Successfully scraped ${data.pages_scraped} pages and created ${data.chunks_created} text chunks.`
        });
        // Clear any existing messages when scraping new content
        setMessages([]);
        
        setTimeout(() => {
          setScrapeProgress(0);
        }, 1000);
      } else {
        setScrapeStatus({
          type: 'error',
          message: data.message || 'Failed to scrape website'
        });
        setScrapeProgress(0);
      }
    } catch (error) {
      clearInterval(progressInterval);
      setScrapeStatus({
        type: 'error',
        message: `Error: ${error.message}`
      });
      setScrapeProgress(0);
    } finally {
      setIsScrapingLoading(false);
    }
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    const userQuestion = question.trim();
    setQuestion('');
    setIsChatLoading(true);

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: userQuestion
    };
    setMessages(prev => [...prev, userMessage]);

    // Add loading message
    const loadingMessage = {
      id: Date.now() + 1,
      type: 'loading',
      content: 'Thinking...'
    };
    setMessages(prev => [...prev, loadingMessage]);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userQuestion,
          top_k: 5
        }),
      });

      const data = await response.json();

      // Remove loading message and add bot response
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.type !== 'loading');
        const botMessage = {
          id: Date.now() + 2,
          type: 'bot',
          content: data.success ? data.answer : data.error || 'Sorry, I encountered an error while processing your question.',
          sources: data.sources || []
        };
        return [...filtered, botMessage];
      });

    } catch (error) {
      // Remove loading message and add error response
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.type !== 'loading');
        const errorMessage = {
          id: Date.now() + 2,
          type: 'bot',
          content: `Error: ${error.message}`,
          sources: []
        };
        return [...filtered, errorMessage];
      });
    } finally {
      setIsChatLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChat(e);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Website Chat Tool</h1>
        <p>Scrape any website and chat with its content using AI</p>
      </header>

      <div className="container">
        {currentMode === 'scrape' ? (
          /* Scraping Mode */
          <section className="scrape-mode">
            <div className="url-section">
              <h2>Enter Website Details</h2>
              <form onSubmit={handleScrape}>
                <div className="input-row">
                  <div className="input-group">
                    <label htmlFor="url">Website URL</label>
                    <input
                      id="url"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="url-input"
                      disabled={isScrapingLoading}
                      required
                    />
                  </div>
                  <div className="input-group depth-group">
                    <label htmlFor="depth">Crawl Depth</label>
                    <select
                      id="depth"
                      value={depth}
                      onChange={(e) => setDepth(parseInt(e.target.value))}
                      className="depth-select"
                      disabled={isScrapingLoading}
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
                  className="scrape-btn"
                  disabled={isScrapingLoading || !url.trim()}
                >
                  {isScrapingLoading ? 'Scraping...' : 'Start Scraping'}
                </button>
              </form>

              {isScrapingLoading && (
                <div className="progress-section">
                  <div className="progress-info">
                    <span>Scraping website and processing content...</span>
                    <span>{Math.round(scrapeProgress)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${scrapeProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {scrapeStatus && (
                <div className={`status-message status-${scrapeStatus.type}`}>
                  {scrapeStatus.message}
                </div>
              )}

              {scrapedData && (
                <div className="mode-selection">
                  <h3>Scraping Complete! Choose how to interact:</h3>
                  <div className="mode-buttons">
                    <button
                      onClick={() => setCurrentMode('chat')}
                      className="mode-btn chat-btn"
                    >
                      💬 Chat Mode
                      <span>Ask questions about the content</span>
                    </button>
                    <button
                      onClick={() => setCurrentMode('voice')}
                      className="mode-btn talk-btn"
                    >
                      🎙️ Talk Mode
                      <span>Voice conversation with AI</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : currentMode === 'chat' ? (
          /* Chat Mode */
          <section className="chat-mode">
            <div className="mode-header">
              <button
                onClick={() => setCurrentMode('scrape')}
                className="back-btn"
              >
                ← Back to Scraping
              </button>
              <div className="scraped-info">
                <h3>Chatting with: {new URL(url).hostname}</h3>
                <p>{scrapedData?.pages_scraped} pages • {scrapedData?.chunks_created} chunks</p>
              </div>
              {messages.length > 0 && (
                <button onClick={clearChat} className="clear-btn">
                  Clear Chat
                </button>
              )}
            </div>

            <div className="chat-section">
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="empty-state">
                    Ask me anything about the content from {new URL(url).hostname}
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`message message-${message.type}`}
                    >
                      {message.content}
                      {message.sources && message.sources.length > 0 && (
                        <div className="sources">
                          <strong>Sources:</strong>{' '}
                          {message.sources.map((source, index) => (
                            <a
                              key={index}
                              href={source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="source-link"
                            >
                              {new URL(source).hostname}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleChat} className="chat-input-group">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask a question about the website content..."
                  className="chat-input"
                  disabled={isChatLoading}
                  rows="1"
                />
                <button
                  type="submit"
                  className="send-btn"
                  disabled={isChatLoading || !question.trim()}
                >
                  {isChatLoading ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          </section>
        ) : (
          /* Voice Mode */
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