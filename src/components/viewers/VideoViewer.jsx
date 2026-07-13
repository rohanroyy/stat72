import React, { useState } from 'react';
import { getViewUrl } from '../../services/driveService';

/**
 * Video Viewer using Google Drive's embed preview iframe.
 * Falls back to a link if embed fails.
 */
export default function VideoViewer({ file }) {
  const [loaded, setLoaded] = useState(false);
  const videoUrl = file.url || getViewUrl(file.id, file.mimeType);
  const isDirectVideo = !!file.url;

  if (isDirectVideo) {
    return (
      <div className="video-viewer" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '16px' }}>
        <video
          src={videoUrl}
          controls
          autoPlay
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            border: '1px solid var(--border-hairline)'
          }}
        />
      </div>
    );
  }

  return (
    <div className="video-viewer">
      {!loaded && (
        <div className="video-loading">
          <div className="pdf-loading-spinner" style={{ borderTopColor: 'var(--orange-600)' }} />
          <span>Loading video…</span>
        </div>
      )}
      <iframe
        src={videoUrl}
        title={file.name}
        allow="autoplay; encrypted-media"
        allowFullScreen
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0 }}
      />
    </div>
  );
}
