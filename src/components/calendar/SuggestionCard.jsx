import React, { useState, useEffect, useRef } from 'react';

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

/**
 * SuggestionCard
 *
 * Props:
 *   - suggestion         – suggestion object (attachment field may be array or legacy single object)
 *   - examId             – parent exam ID (used to build shareable link)
 *   - currentUserId      – logged-in user's ID
 *   - isHighlighted      – true when arrived via deep link to this suggestion
 *   - onEdit(suggestion)
 *   - onDelete(suggestion)
 *   - onAttachmentClick(attachment)
 */
export default function SuggestionCard({
  suggestion,
  examId,
  currentUserId,
  isHighlighted,
  onEdit,
  onDelete,
  onAttachmentClick,
}) {
  const isOwner = currentUserId && suggestion.uploader_id === currentUserId;
  const { text } = suggestion;

  // ── Normalize attachments ──────────────────────────────────────────────────
  // DB column 'attachment' may be:
  //   - null/undefined  → no attachments (old empty)
  //   - plain object    → legacy single attachment
  //   - array           → new multi-attachment
  const attachments = Array.isArray(suggestion.attachment)
    ? suggestion.attachment
    : suggestion.attachment
      ? [suggestion.attachment]
      : [];

  // ── Copy-link state ────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);

  // ── Highlight fade-out ─────────────────────────────────────────────────────
  // The class is added immediately, giving border + glow.
  // After 2.5 s we remove the class; the transition on .suggestion-card
  // causes the card to fade smoothly back to its normal appearance.
  const [isHighlightActive, setIsHighlightActive] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!isHighlighted) return;

    // Activate highlight
    setIsHighlightActive(true);

    // Scroll into view after the panel's entry animation
    const scrollTimer = setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 420);

    // Fade back to normal
    const fadeTimer = setTimeout(() => {
      setIsHighlightActive(false);
    }, 2800);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(fadeTimer);
    };
  }, [isHighlighted]);

  // ── Share link ─────────────────────────────────────────────────────────────
  // Short format: ?e=EXAM_ID&s=SUGG_ID  (no tab= param needed)
  const handleCopyLink = (e) => {
    e.stopPropagation();
    const url = new URL(window.location.origin);
    url.searchParams.set('e', examId);
    url.searchParams.set('s', suggestion.id);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <div
      ref={cardRef}
      className={`suggestion-card${isHighlightActive ? ' suggestion-card--highlighted' : ''}`}
    >
      <div className="suggestion-card-body">
        {text && <p className="suggestion-text">{text}</p>}

        {/* ── Attachments list ───────────────────────────────────────────── */}
        {attachments.length > 0 && (
          <div className="suggestion-attachments-list">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="suggestion-attachment suggestion-attachment--clickable"
                onClick={() => onAttachmentClick && onAttachmentClick(att)}
                role="button"
                tabIndex={0}
                onKeyDown={ev => { if (ev.key === 'Enter') onAttachmentClick?.(att); }}
              >
                <span className="suggestion-attachment-icon">
                  {att.type === 'folder'
                    ? <FolderIcon />
                    : <FileIcon mimeType={att.mimeType} />
                  }
                </span>
                <span className="suggestion-attachment-name">{att.name}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))}
          </div>
        )}

        {!text && attachments.length === 0 && (
          <p className="suggestion-text" style={{ color: 'var(--text-card-muted)', fontStyle: 'italic' }}>
            (empty suggestion)
          </p>
        )}
      </div>

      <div className="suggestion-card-footer">
        <span className="suggestion-uploader">suggested by {suggestion.uploader_name}</span>

        <div className="suggestion-actions">
          {/* Copy shareable link — available to all users */}
          <button
            className={`suggestion-copy-link-btn${copied ? ' copied' : ''}`}
            onClick={handleCopyLink}
            aria-label="Copy suggestion link"
            title={copied ? 'Link copied!' : 'Copy link to this suggestion'}
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
          </button>

          {isOwner && (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
