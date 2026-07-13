import React, { useState } from 'react';

/**
 * Setup screen shown when no API key is configured.
 * User can enter their key which gets saved to localStorage.
 */
export default function ApiKeySetup({ onKeySubmit }) {
  const [key, setKey] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = key.trim();
    if (trimmed) {
      onKeySubmit(trimmed);
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-logo">StudyDock</div>

      <div className="setup-card">
        <h2>Connect Google Drive</h2>
        <p>
          Enter your Google API key to browse your Drive files directly in StudyDock.
          The key is stored locally in your browser — never sent anywhere else.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="setup-input-group">
            <label className="setup-label" htmlFor="api-key-input">
              Google API Key
            </label>
            <input
              id="api-key-input"
              className="setup-input"
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="AIzaSy..."
              autoComplete="off"
              spellCheck="false"
            />
          </div>

          <button
            type="submit"
            className="setup-submit"
            disabled={!key.trim()}
          >
            Connect & Browse Files
          </button>
        </form>

        <div className="setup-steps">
          <h3>How to get an API Key</h3>
          <ol>
            <li>
              Go to{' '}
              <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">
                console.cloud.google.com
              </a>
            </li>
            <li>Create a new project (or select existing)</li>
            <li>Go to <strong>APIs &amp; Services → Library</strong></li>
            <li>Search for and enable <strong>"Google Drive API"</strong></li>
            <li>Go to <strong>Credentials → Create Credentials → API Key</strong></li>
            <li>Copy the key and paste it above</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
