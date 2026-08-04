import React from 'react';
import { IconFolder, IconAlertCircle } from '../common/Icons';

export function EmptyState({ filter = 'all' }) {
  const messages = {
    all: { title: 'No files here yet.', desc: 'Files added to the connected Google Drive folder will appear here automatically.' },
    pdf: { title: 'No PDFs found.', desc: 'PDF documents in this folder will show up here.' },
    image: { title: 'No images found.', desc: 'Images in this folder will show up here.' },
    video: { title: 'No videos found.', desc: 'Video files in this folder will show up here.' },
    folder: { title: 'No subfolders here.', desc: 'Subfolders created in Google Drive will appear automatically.' },
  };

  const msg = messages[filter] || messages.all;

  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <IconFolder size={28} />
      </div>
      <div className="empty-state-title">{msg.title}</div>
      <div className="empty-state-desc">{msg.desc}</div>
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const isApiKeyError = error === 'NO_API_KEY' || 
                        (error && error.includes('API configuration is missing')) || 
                        (error && error.includes('API credentials are missing')) ||
                        (error && error.includes('API key or OAuth token required'));

  const isAdmin = window.location.search.includes('admin=true') || window.location.search.includes('page=admin');

  return (
    <div className="error-state">
      <div className="error-card">
        <div className="error-icon">
          <IconAlertCircle size={24} />
        </div>
        <div className="error-title">
          {isApiKeyError ? 'Google Drive Not Configured' : 'Unable to load files'}
        </div>
        <div className="error-message">
          {isApiKeyError
            ? (isAdmin
                ? 'Please configure your Google Drive API key or Service Account in the settings below.'
                : 'Google Drive integration has not been configured by the admin yet. Please use other tabs or contact your admin.')
            : error
          }
        </div>
        {!isApiKeyError && onRetry && (
          <button className="error-retry" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="skeleton-list">
      {Array.from({ length: 6 }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton-icon" />
          <div className="skeleton-lines">
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        </div>
      ))}
    </div>
  );
}
