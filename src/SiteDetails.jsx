import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

function SiteDetails({ siteId, onBack, onDelete }) {
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/sites/${encodeURIComponent(siteId)}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        setSite(data);
        setLoading(false);
      })
      .catch(() => {
        setSite(null);
        setLoading(false);
      });
  }, [siteId]);

  if (loading) return <div>Loading...</div>;
  if (!site) return <div>Site not found.</div>;

  return (
    <div>
      <button onClick={onBack}>Back</button>
      <h2>{site.domain || siteId}</h2>
      <button onClick={() => onDelete(siteId)}>Delete from Knowledge Base</button>
      <h3>Sitemap Graph</h3>
      <pre style={{ maxHeight: 300, overflow: 'auto' }}>
        {JSON.stringify(site.sitemap, null, 2)}
      </pre>
    </div>
  );
}

export default SiteDetails;
