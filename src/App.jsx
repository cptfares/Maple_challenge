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

  const handleShowSiteDetails = (siteId) => {
    setSelectedSiteId(siteId);
  };

  const handleDeleteSite = async (siteId) => {
    await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
    setSelectedSiteId(null);
    // Refresh sites list
    const response = await fetch(`${API_BASE}/sites`);
    const data = await response.json();
    setScrapedSites(data);
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
            onShowSiteDetails={handleShowSiteDetails} // pass this prop
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
            setSelectedDomain={setSelectedDomain}
            setCurrentMode={setCurrentMode}
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