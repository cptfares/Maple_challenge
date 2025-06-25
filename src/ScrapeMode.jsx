import React from 'react';

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
  setCurrentMode
}) {
  return (
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
                <h4>Text chat mode </h4>
                <span>Multi-site queries, structure analysis, content discovery</span>
              </div>
            </button>
            <button
              onClick={() => setCurrentMode('voice')}
              className="mode-btn talk-btn"
            >
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
  );
}

export default ScrapeMode;
