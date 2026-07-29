import React from 'react';

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FileIcon({ mimeType }) {
  if (!mimeType) return <DefaultFileIcon />;
  if (mimeType === 'application/pdf') return <PdfIcon />;
  if (mimeType.startsWith('image/')) return <ImageIcon />;
  return <DefaultFileIcon />;
}

function PdfIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function DefaultFileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

export default function SuggestionCard({ suggestion, currentUserId, onEdit, onDelete, onAttachmentClick }) {
  const isOwner = currentUserId && suggestion.uploader_id === currentUserId;
  const { text, attachment } = suggestion;

  return (
    <div className="suggestion-card">
      <div className="suggestion-card-body">
        {text && <p className="suggestion-text">{text}</p>}

        {attachment && (
          <div
            className="suggestion-attachment suggestion-attachment--clickable"
            onClick={() => onAttachmentClick && onAttachmentClick(attachment)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') onAttachmentClick?.(attachment); }}
          >
            <span className="suggestion-attachment-icon">
              {attachment.type === 'folder'
                ? <FolderIcon />
                : <FileIcon mimeType={attachment.mimeType} />
              }
            </span>
            <span className="suggestion-attachment-name">{attachment.name}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        )}

        {!text && !attachment && (
          <p className="suggestion-text" style={{ color: 'var(--text-card-muted)', fontStyle: 'italic' }}>
            (empty suggestion)
          </p>
        )}
      </div>

      <div className="suggestion-card-footer">
        <span className="suggestion-uploader">suggested by {suggestion.uploader_name}</span>

        {isOwner && (
          <div className="suggestion-actions">
            <button
              className="suggestion-action-btn"
              onClick={() => onEdit(suggestion)}
              aria-label="Edit suggestion"
              title="Edit"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              className="suggestion-action-btn suggestion-action-btn--delete"
              onClick={() => onDelete(suggestion)}
              aria-label="Delete suggestion"
              title="Delete"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

