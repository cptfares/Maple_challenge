import React, { useState } from 'react';

function ScrapeMode({
  url,
  setUrl,
  maxDepth,
  setMaxDepth,
  handleScrape,
  isScrapingLoading,
  scrapeStatus,
  scrapedData,
  scrapedSites,
  setCurrentMode,
  handleDeleteSite
}) {
  const [selectedSite, setSelectedSite] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleSiteClick = (domain, info) => {
    setSelectedSite({ domain, info });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedSite(null);
  };

  return (
    <section className="scrape-mode">
      <div className="mode-header">
        <h2>Multi-Site Knowledge Base</h2>
        <p>Add websites to build your comprehensive knowledge base</p>
      </div>

      {(scrapedData || (scrapedSites && scrapedSites.total_sites > 0)) && (
        <div className="mode-selection">
          <h3>Knowledge Base Ready - Choose Interaction Mode:</h3>
          <div className="mode-buttons">
            <button onClick={() => setCurrentMode('chat')} className="mode-btn chat-btn">
              <div className="mode-icon">💬</div>
              <div className="mode-content">
                <h4>Text chat mode</h4>
                <span>Multi-site queries, structure analysis, content discovery</span>
              </div>
            </button>
            <button onClick={() => setCurrentMode('voice')} className="mode-btn talk-btn">
              <div className="mode-icon">🎙️</div>
              <div className="mode-content">
                <h4>Voice chat mode</h4>
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
              <div
                key={domain}
                className="site-card"
                onClick={() => handleSiteClick(domain, info)}
                style={{ cursor: 'pointer' }}
              >
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

      {/* Proper Modal Popup */}
      {showModal && selectedSite && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={closeModal}
        >
          <div
            className="modal-content"
            style={{
              backgroundColor: 'white',
              padding: 24,
              borderRadius: 8,
              maxWidth: 800,
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close-modal"
              onClick={closeModal}
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                fontSize: 24,
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
            <h2 style={{ marginBottom: 8, color: '#2a3b4c' }}>
              <span role="img" aria-label="site">🌐</span> {selectedSite.domain}
            </h2>
            <div className="site-summary" style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
              <div style={{ minWidth: 120 }}>
                <div style={{ fontWeight: 'bold', fontSize: 18, color: '#3a5d7c' }}>Pages</div>
                <div style={{ fontSize: 22, color: '#1e90ff' }}>{selectedSite.info.total_pages}</div>
              </div>
              <div style={{ minWidth: 120 }}>
                <div style={{ fontWeight: 'bold', fontSize: 18, color: '#3a5d7c' }}>APIs</div>
                <div style={{ fontSize: 22, color: '#1e90ff' }}>{selectedSite.info.structure.total_api_endpoints}</div>
              </div>
              <div style={{ minWidth: 120 }}>
                <div style={{ fontWeight: 'bold', fontSize: 18, color: '#3a5d7c' }}>Images</div>
                <div style={{ fontSize: 22, color: '#1e90ff' }}>{selectedSite.info.structure.total_images}</div>
              </div>
            </div>
            <div className="site-map-graph" style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 8, color: '#2a3b4c' }}>Site Map Graph</h3>
              <SiteMapGraph sitemap={selectedSite.info.structure.sitemap} />
            </div>

            {/* Delete Button Inside Modal */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  handleDeleteSite(selectedSite.domain);
                  closeModal();
                }}
                className="delete-site-btn"
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Delete Site
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default ScrapeMode;
