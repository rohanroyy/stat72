import React, { useState, useRef, useEffect } from 'react';
import { uploadConfusionImages } from '../../services/confusionService';

/**
 * ConfusionComposer
 * Bottom-sheet for writing a new post or reply, with optional image attachments.
 *
 * Props:
 *   - open: boolean
 *   - mode: 'post' | 'reply'
 *   - editingPost: post object | null (for editing existing post)
 *   - examId, examName, suggestionUploadFolder  — for Drive uploads
 *   - onSubmit({ text, images })
 *   - onClose()
 */
export default function ConfusionComposer({
  open,
  mode = 'post',
  editingPost = null,
  examId,
  examName,
  suggestionUploadFolder,
  onSubmit,
  onClose,
}) {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]); // [{type,name,driveId,mimeType,uploaded}]
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [uploadError, setUploadError] = useState('');
  const textRef = useRef(null);
  const fileInputRef = useRef(null);

  // Pre-fill when editing
  useEffect(() => {
    if (open) {
      setText(editingPost?.text || '');
      setImages(Array.isArray(editingPost?.images) ? editingPost.images : []);
      setUploadError('');
      setUploading(false);
      setUploadProgress(0);
    }
  }, [open, editingPost]);

  // Focus textarea on open
  useEffect(() => {
    if (open && textRef.current) {
      setTimeout(() => textRef.current?.focus(), 80);
    }
  }, [open]);

  const handleBackdrop = (e) => {
    if (uploading) return;
    if (e.target === e.currentTarget) onClose();
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setUploadError('');
    setUploading(true);
    setUploadProgress(0);

    try {
      const newImages = await uploadConfusionImages(
        files,
        examId,
        examName,
        suggestionUploadFolder,
        (pct, cur, total) => {
          setUploadProgress(pct);
          setUploadLabel(`${cur}/${total}`);
        }
      );
      setImages(prev => [...prev, ...newImages]);
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadLabel('');
    }
  };

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed && images.length === 0) return;
    onSubmit({ text: trimmed || null, images });
  };

  const canSubmit = !uploading && (text.trim() || images.length > 0);
  const isEditing = !!editingPost;

  if (!open) return null;

  return (
    <div className="cf-composer-backdrop" onClick={handleBackdrop}>
      <div className="cf-composer-sheet" onClick={e => e.stopPropagation()}>

        {/* Progress bar */}
        {uploading && (
          <div className="cf-composer-progress-track">
            <div
              className="cf-composer-progress-bar"
              style={{ width: uploadProgress > 0 ? `${uploadProgress}%` : '15%' }}
            />
          </div>
        )}

        {/* Header */}
        <div className="cf-composer-header">
          <span className="cf-composer-title">
            {isEditing ? 'Edit doubt' : mode === 'post' ? 'Post a doubt' : 'Write a reply'}
          </span>
          <button
            className="cf-composer-close"
            onClick={onClose}
            disabled={uploading}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textRef}
          className="cf-composer-textarea"
          placeholder={mode === 'post' ? "What are you confused about? Describe your doubt…" : "Share your answer or insight…"}
          value={text}
          onChange={e => setText(e.target.value)}
          rows={4}
        />

        {/* Attached images list */}
        {images.length > 0 && (
          <div className="cf-composer-images">
            {images.map((img, idx) => (
              <div key={idx} className="cf-composer-img-chip">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="cf-composer-img-name">{img.name}</span>
                <button
                  className="cf-composer-img-remove"
                  onClick={() => removeImage(idx)}
                  disabled={uploading}
                  aria-label={`Remove ${img.name}`}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="cf-composer-uploading">
            <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
            <span>Uploading image {uploadLabel}{uploadProgress > 0 ? ` · ${uploadProgress}%` : '…'}</span>
          </div>
        )}

        {/* Error */}
        {uploadError && (
          <p className="cf-composer-error">{uploadError}</p>
        )}

        {/* Actions row */}
        <div className="cf-composer-actions">
          {/* Image attach button */}
          <button
            className="cf-composer-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Attach images"
            title="Attach images"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            {images.length > 0 && <span className="cf-composer-attach-count">{images.length}</span>}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Submit */}
          <button
            className="cf-composer-submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isEditing ? 'Save changes' : mode === 'post' ? 'Post' : 'Reply'}
          </button>
        </div>

      </div>
    </div>
  );
}
