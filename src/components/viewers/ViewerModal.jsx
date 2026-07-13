import React, { useEffect } from 'react';
import { IconX, IconDownload, IconExternalLink } from '../common/Icons';
import { getDownloadUrl } from '../../services/driveService';

/**
 * ViewerModal wraps any file viewer with a toolbar.
 * Supports both Google Drive files (id-based) and Telegram files (url-based).
 */
export default function ViewerModal({ file, onClose, children }) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Telegram file: download via direct URL
  const isTelegramFile = !!file.tgFileId || !!file.url;

  const handleDownload = () => {
    if (file.url) {
      // Telegram or any direct URL — open/download directly
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name || 'download';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    } else {
      // Google Drive file
      const url = getDownloadUrl(file.id);
      window.open(url, '_blank');
    }
  };

  const handleOpenExternal = () => {
    if (file.url) {
      window.open(file.url, '_blank');
    } else {
      window.open(`https://drive.google.com/file/d/${file.id}/view`, '_blank');
    }
  };

  return (
    <div className="viewer-overlay" role="dialog" aria-modal="true" aria-label={`Viewing ${file.name}`}>
      <div className="viewer-toolbar">
        <div className="viewer-toolbar-left">
          <button className="viewer-close" onClick={onClose} aria-label="Close viewer">
            <IconX size={20} />
          </button>
          <span className="viewer-filename" title={file.name}>{file.name}</span>
          {isTelegramFile && (
            <span style={{
              fontSize: '10px',
              fontWeight: '600',
              background: 'rgba(39,174,229,0.18)',
              color: '#27aee5',
              borderRadius: '4px',
              padding: '2px 7px',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}>
              TG
            </span>
          )}
        </div>
        <div className="viewer-toolbar-right">
          <button
            className="viewer-toolbar-btn"
            onClick={handleDownload}
            aria-label="Download file"
            title={file.url ? 'Download file' : 'Download from Drive'}
          >
            <IconDownload size={18} />
          </button>
          <button
            className="viewer-toolbar-btn"
            onClick={handleOpenExternal}
            aria-label="Open externally"
            title={file.url ? 'Open in new tab' : 'Open in Google Drive'}
          >
            <IconExternalLink size={18} />
          </button>
        </div>
      </div>
      <div className="viewer-body">
        {children}
      </div>
    </div>
  );
}
