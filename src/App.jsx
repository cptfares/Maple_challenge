import React, { useState } from 'react';

const API_BASE = '/api';

function App() {
  const [url, setUrl] = useState('');
  const [scrapeStatus, setScrapeStatus] = useState(null);
  const [isScrapingLoading, setIsScrapingLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

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
          url: url.trim(),
          max_depth: 2
        }),
      });

      const data = await response.json();

      if (data.success) {
        setScrapeStatus({
          type: 'success',
          message: `Successfully scraped ${data.pages_scraped} pages and created ${data.chunks_created} text chunks. Ready to answer questions!`
        });
        // Clear any existing messages when scraping new content
        setMessages([]);
      } else {
        setScrapeStatus({
          type: 'error',
          message: data.message || 'Failed to scrape website'
        });
      }
    } catch (error) {
      setScrapeStatus({
        type: 'error',
        message: `Error: ${error.message}`
      });
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
        {/* URL Input Section */}
        <section className="url-section">
          <h2>1. Enter Website URL</h2>
          <form onSubmit={handleScrape}>
            <div className="url-input-group">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="url-input"
                disabled={isScrapingLoading}
                required
              />
              <button
                type="submit"
                className="scrape-btn"
                disabled={isScrapingLoading || !url.trim()}
              >
                {isScrapingLoading ? 'Scraping...' : 'Scrape Website'}
              </button>
            </div>
          </form>

          {isScrapingLoading && (
            <div className="status-message status-loading">
              Scraping website and processing content... This may take a moment.
            </div>
          )}

          {scrapeStatus && (
            <div className={`status-message status-${scrapeStatus.type}`}>
              {scrapeStatus.message}
            </div>
          )}
        </section>

        {/* Chat Section */}
        <section className="chat-section">
          <div className="chat-header">
            <h2>2. Ask Questions</h2>
            {messages.length > 0 && (
              <button onClick={clearChat} className="clear-btn">
                Clear Chat
              </button>
            )}
          </div>

          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="empty-state">
                Scrape a website first, then ask questions about its content
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
        </section>
      </div>
    </div>
  );
}

export default App;