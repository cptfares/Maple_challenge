import React, { useState, useEffect } from 'react';
import Header from './Header.jsx';
import ScrapeMode from './ScrapeMode.jsx';
import ChatMode from './ChatMode.jsx';
import VoiceChat from './VoiceChat.jsx';
import SiteDetails from './SiteDetails.jsx';

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
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [chatMode, setChatMode] = useState('knowledge'); // NEW: Manual chat mode toggle

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsScrapingLoading(true);
    setScrapeStatus(null);

    try {
      const response = await fetch(`${API_BASE}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url,
          max_depth: parseInt(maxDepth)
        }),
      });

      const data = await response.json();

      if (data.success) {
        setScrapeStatus('success');
        setScrapedData(data);

        // Refresh sites list
        const sitesResponse = await fetch(`${API_BASE}/sites`);
        const sitesData = await sitesResponse.json();
        setScrapedSites(sitesData);
        setUrl('');
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
      const endpoint = chatMode === 'structure' ? '/query/structure' : '/chat';

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // Initial fetch of scraped sites
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

  const handleShowSiteDetails = (siteId) => {
    setSelectedSiteId(siteId);
  };

  const handleDeleteSite = async (siteId) => {
    try {
      const response = await fetch(`${API_BASE}/sites/${encodeURIComponent(siteId)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        let errorMsg = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMsg = errorData.detail || response.statusText;
        } catch {}
        alert(`Failed to delete site: ${errorMsg}`);
        return;
      }

      setSelectedSiteId(null);

      const sitesResponse = await fetch(`${API_BASE}/sites`);
      const sitesData = await sitesResponse.json();
      setScrapedSites(sitesData);
    } catch (error) {
      console.error('Delete site error:', error);
      alert('Network error occurred while deleting the site.');
    }
  };

  return (
    <div className="app">
      <Header currentMode={currentMode} setCurrentMode={setCurrentMode} />
      <div className="app-content">
        {selectedSiteId ? (
          <SiteDetails
            siteId={selectedSiteId}
            onBack={() => setSelectedSiteId(null)}
            onDelete={handleDeleteSite}
          />
        ) : currentMode === 'scrape' ? (
          <ScrapeMode
            url={url}
            setUrl={setUrl}
            maxDepth={maxDepth}
            setMaxDepth={setMaxDepth}
            handleScrape={handleScrape}
            isScrapingLoading={isScrapingLoading}
            scrapeStatus={scrapeStatus}
            scrapedData={scrapedData}
            scrapedSites={scrapedSites}
            setCurrentMode={setCurrentMode}
            handleDeleteSite={handleDeleteSite}
          />
        ) : currentMode === 'chat' ? (
          <ChatMode
            messages={messages}
            setMessages={setMessages}
            question={question}
            setQuestion={setQuestion}
            handleChat={handleChat}
            isChatLoading={isChatLoading}
            clearMessages={clearMessages}
            scrapedSites={scrapedSites}
            selectedDomain={selectedDomain}
            setCurrentMode={setCurrentMode}
            chatMode={chatMode}            // NEW
            setChatMode={setChatMode}      // NEW
          />
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
