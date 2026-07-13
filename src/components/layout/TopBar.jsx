import React from 'react';
import { IconRefresh } from '../common/Icons';

export default function TopBar({ title = 'Files', lastUpdated, loading, onRefresh }) {
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-actions">
        <div className="refresh-indicator">
          <span className={`refresh-dot ${loading ? 'loading' : ''}`} />
          {loading && <span className="refresh-text">Syncing...</span>}
        </div>
        <button
          className="topbar-btn"
          onClick={onRefresh}
          aria-label="Refresh"
          title="Refresh files"
        >
          <IconRefresh size={20} />
        </button>
      </div>
    </header>
  );
}
