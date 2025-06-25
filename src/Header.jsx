import React from 'react';

function Header({ currentMode, setCurrentMode }) {
  return (
    <header className="app-header enhanced-header">
      <div className="header-gradient">
        <div className="header-main">
          <h1 className="main-title">Chat with website</h1>
          <p className="subtitle">Multi-site analysis, structural queries, and intelligent content discovery</p>
        </div>
        {(currentMode === 'chat' || currentMode === 'voice') && (
          <div className="header-nav-row">

            <span className="section-title">Enhanced Knowledge Assistant</span>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
