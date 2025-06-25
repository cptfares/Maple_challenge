import React from 'react';

// Build tree from sitemap
function buildTree(sitemap) {
  if (!Array.isArray(sitemap) || sitemap.length === 0) return null;
  // Find root (depth 0)
  const nodes = sitemap.map((page, idx) => ({
    ...page,
    idx,
    children: []
  }));
  nodes.forEach((node, idx) => {
    if (node.depth > 0) {
      // Find parent: closest with depth-1 and url is substring
      const parentIdx = nodes.findIndex(
        (p, i) => i !== idx && p.depth === node.depth - 1 && node.url.startsWith(p.url)
      );
      if (parentIdx !== -1) {
        nodes[parentIdx].children.push(node);
      }
    }
  });
  // Return root(s)
  return nodes.filter(n => n.depth === 0);
}

// Recursively render the tree as indented links
function renderTree(nodes, level = 0) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul style={{ listStyle: 'none', paddingLeft: level === 0 ? 0 : 18, margin: 0 }}>
      {nodes.map(node => (
        <li key={node.idx} style={{ marginBottom: 4 }}>
          <a
            href={node.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: level === 0 ? '#1e90ff' : '#2a3b4c',
              fontWeight: level === 0 ? 'bold' : 'normal',
              textDecoration: 'underline',
              fontSize: 14,
              wordBreak: 'break-all',
            }}
            title={node.url}
          >
            {node.url}
          </a>
          {renderTree(node.children, level + 1)}
        </li>
      ))}
    </ul>
  );
}

const SiteMapGraph = ({ sitemap }) => {
  const roots = buildTree(sitemap);
  if (!roots || roots.length === 0) return <div>No site map data available.</div>;
  return (
    <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, maxHeight: 400, overflowY: 'auto' }}>
      {renderTree(roots)}
    </div>
  );
};

export default SiteMapGraph;
