import React, { useState, useEffect, useRef } from 'react';
import { listFolder, uploadFileToDrive } from '../../services/driveService';
import { getApiKey, extractFolderId } from '../../config/drive';

/**
 * AddSuggestionModal
 * A bottom-sheet for toppers to add or edit a suggestion.
 * Supports multiple file uploads and Drive picker attachments.
 *
 * Props:
 *   - open: boolean
 *   - editingSuggestion: suggestion object | null
 *   - foldersList: configured root drive folders
 *   - suggestionUploadFolder: Google Drive folder ID or link for uploads
 *   - onSubmit({ text, attachments })   ← attachments is always an array
 *   - onClose()
 */
export default function AddSuggestionModal({
  open,
  editingSuggestion,
  foldersList = [],
  suggestionUploadFolder = '',
  onSubmit,
  onClose,
}) {
  const [text, setText] = useState('');
  // attachments is always an array: [{ type, name, driveId, mimeType? }, ...]
  const [attachments, setAttachments] = useState([]);

  // Drive picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStack, setPickerStack] = useState([]);
  const [pickerFolders, setPickerFolders] = useState([]);
  const [pickerFiles, setPickerFiles] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);   // 0-100 overall
  const [uploadingLabel, setUploadingLabel] = useState('');   // e.g. "2/3"
  const [uploadError, setUploadError] = useState('');

  const textRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Reset / prefill on open ────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setText(editingSuggestion?.text || '');

      // Normalize: new data has attachment[] array; old data has a single object or null
      const existing = Array.isArray(editingSuggestion?.attachment)
        ? editingSuggestion.attachment
        : editingSuggestion?.attachment
          ? [editingSuggestion.attachment]
          : [];
      setAttachments(existing);

      setPickerOpen(false);
      setPickerStack([]);
      setPickerFolders([]);
      setPickerFiles([]);
      setPickerError('');
      setUploading(false);
      setUploadProgress(0);
      setUploadingLabel('');
      setUploadError('');
    }
  }, [open, editingSuggestion]);

  // Focus textarea on open
  useEffect(() => {
    if (open && textRef.current) {
      setTimeout(() => textRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on backdrop click (not while uploading)
  const handleBackdropClick = (e) => {
    if (uploading) return;
    if (e.target === e.currentTarget) onClose();
  };

  // ── Upload from device (supports multiple files) ───────────────────────────
  const handleUploadButtonClick = () => {
    setUploadError('');
    const parentFolderId = extractFolderId(suggestionUploadFolder);
    if (!parentFolderId) {
      setUploadError('Admin has not configured an Upload Folder in Admin Panel.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const parentFolderId = extractFolderId(suggestionUploadFolder);
    if (!parentFolderId) {
      setUploadError('Admin has not configured an Upload Folder in Admin Panel.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadProgress(0);

    const newAttachments = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadingLabel(`${i + 1}/${files.length}`);

      try {
        const result = await uploadFileToDrive(file, file.name, parentFolderId, (pct) => {
          // Overall progress: fraction of completed files + current file's contribution
          const overall = Math.round(((i + pct / 100) / files.length) * 100);
          setUploadProgress(overall);
        });
        newAttachments.push({
          type: 'file',
          name: result.name,
          driveId: result.id,
          mimeType: result.mimeType || file.type,
        });
      } catch (err) {
        console.error(err);
        setUploadError(`Failed to upload "${file.name}": ${err.message}`);
        break; // stop on first failure
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    setUploading(false);
    setUploadProgress(0);
    setUploadingLabel('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Remove an attachment from the list ────────────────────────────────────
  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // ── Drive picker ───────────────────────────────────────────────────────────
  const loadPickerFolder = async (folderId) => {
    setPickerLoading(true);
    setPickerError('');
    try {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error('No API key configured');
      const { folders, files } = await listFolder(folderId, apiKey);
      setPickerFolders(folders);
      setPickerFiles(files.filter(f => f.mimeType === 'application/pdf' || f.mimeType?.startsWith('image/')));
    } catch (err) {
      setPickerError(err.message || 'Failed to load folder');
      setPickerFolders([]);
      setPickerFiles([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const openPickerRoot = () => {
    setPickerOpen(true);
    setPickerStack([]);
    setPickerFolders([]);
    setPickerFiles([]);
  };

  const handlePickerRootFolder = (folder) => {
    const newStack = [{ id: folder.folderId, name: folder.name }];
    setPickerStack(newStack);
    loadPickerFolder(folder.folderId);
  };

  const handlePickerNavigate = (folder) => {
    const newStack = [...pickerStack, { id: folder.id, name: folder.name }];
    setPickerStack(newStack);
    loadPickerFolder(folder.id);
  };

  const handlePickerBack = () => {
    if (pickerStack.length <= 1) {
      setPickerStack([]);
      setPickerFolders([]);
      setPickerFiles([]);
      return;
    }
    const newStack = pickerStack.slice(0, -1);
    setPickerStack(newStack);
    loadPickerFolder(newStack[newStack.length - 1].id);
  };

  // Picker selections append to the attachments array
  const selectFolder = (folder) => {
    setAttachments(prev => [...prev, { type: 'folder', name: folder.name, driveId: folder.id }]);
    setPickerOpen(false);
    setPickerStack([]);
  };

  const selectFile = (file) => {
    setAttachments(prev => [...prev, { type: 'file', name: file.name, driveId: file.id, mimeType: file.mimeType }]);
    setPickerOpen(false);
    setPickerStack([]);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText && attachments.length === 0) return;
    onSubmit({ text: trimmedText || null, attachments });
  };

  const canSubmit = !uploading && (text.trim() || attachments.length > 0);

  if (!open) return null;

  return (
    <div className="sugg-modal-backdrop" onClick={handleBackdropClick}>
      <div className="sugg-modal-sheet">

        {/* ── Thin upload progress bar at top of modal ────────────────────── */}
        {uploading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '3px', background: 'var(--bg-surface-2)',
            borderRadius: '3px 3px 0 0', overflow: 'hidden', zIndex: 10,
          }}>
            <div style={{
              height: '100%',
              width: uploadProgress > 0 ? `${uploadProgress}%` : '15%',
              background: 'linear-gradient(90deg, var(--accent), #ff8c69)',
              borderRadius: '3px',
              transition: uploadProgress > 0 ? 'width 0.3s ease' : 'none',
              animation: uploadProgress === 0 ? 'sugg-progress-indeterminate 1.4s ease infinite' : 'none',
            }} />
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="sugg-modal-header">
          <span className="sugg-modal-title">
            {editingSuggestion ? 'Edit Suggestion' : 'Add Suggestion'}
          </span>
          <button className="sugg-modal-close" onClick={onClose} aria-label="Close" disabled={uploading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!pickerOpen ? (
          /* ── Main form ──────────────────────────────────────────────────── */
          <form onSubmit={handleSubmit} className="sugg-modal-body">
            <textarea
              ref={textRef}
              className="sugg-modal-textarea"
              placeholder="Write something helpful... (optional)"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
            />

            {/* ── Attachment list ─────────────────────────────────────────── */}
            {attachments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {attachments.map((att, idx) => (
                  <div key={idx} className="sugg-attachment-preview">
                    <span className="sugg-attachment-preview-icon">
                      {att.type === 'folder' ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                          <polyline points="13 2 13 9 20 9" />
                        </svg>
                      )}
                    </span>
                    <span className="sugg-attachment-preview-name">{att.name}</span>
                    <button
                      type="button"
                      className="sugg-attachment-remove"
                      onClick={() => removeAttachment(idx)}
                      aria-label={`Remove ${att.name}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Uploading indicator ─────────────────────────────────────── */}
            {uploading && (
              <div className="sugg-upload-progress">
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                <span>
                  Uploading file {uploadingLabel}
                  {uploadProgress > 0 ? ` · ${uploadProgress}%` : '...'}
                </span>
              </div>
            )}

            {/* ── Add attachment buttons — always visible when not uploading ─ */}
            {!uploading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="sugg-pick-drive-btn"
                    onClick={openPickerRoot}
                    style={{ flex: 1 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    {attachments.length > 0 ? 'Add from Drive' : 'Choose from Drive'}
                  </button>

                  <button
                    type="button"
                    className="sugg-pick-drive-btn"
                    onClick={handleUploadButtonClick}
                    style={{ flex: 1 }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {attachments.length > 0 ? 'Upload More' : 'Upload Device File'}
                  </button>
                </div>

                {/* Hidden file input — multiple allowed */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  multiple
                />

                {uploadError && (
                  <div style={{ color: 'var(--accent)', fontSize: '12px', padding: '2px 4px', lineHeight: 1.5 }}>
                    {uploadError}
                  </div>
                )}
              </div>
            )}

            <div className="sugg-modal-actions">
              <button type="button" className="sugg-cancel-btn" onClick={onClose} disabled={uploading}>
                Cancel
              </button>
              <button type="submit" className="sugg-submit-btn" disabled={!canSubmit}>
                {editingSuggestion ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        ) : (
          /* ── Drive picker ───────────────────────────────────────────────── */
          <div className="sugg-picker-body">
            <div className="sugg-picker-nav">
              {pickerStack.length > 0 && (
                <button className="sugg-picker-back" onClick={handlePickerBack} aria-label="Back">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}
              <span className="sugg-picker-breadcrumb">
                {pickerStack.length === 0 ? 'Select a Drive' : pickerStack[pickerStack.length - 1].name}
              </span>
              <button className="sugg-modal-close" onClick={() => setPickerOpen(false)} aria-label="Cancel picker">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="sugg-picker-list">
              {/* Root: configured drives */}
              {pickerStack.length === 0 && (
                foldersList.length === 0 ? (
                  <div className="sugg-picker-empty">No drives configured</div>
                ) : (
                  foldersList.map(folder => (
                    <button
                      key={folder.id}
                      className="sugg-picker-item"
                      onClick={() => handlePickerRootFolder(folder)}
                    >
                      <span className="sugg-picker-item-icon">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      </span>
                      <span className="sugg-picker-item-name">{folder.name}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--text-card-muted)' }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  ))
                )
              )}

              {/* Inside a folder */}
              {pickerStack.length > 0 && (
                <>
                  {pickerLoading && (
                    <div className="sugg-picker-loading">
                      <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                    </div>
                  )}
                  {pickerError && (
                    <div className="sugg-picker-empty" style={{ color: 'var(--accent)' }}>{pickerError}</div>
                  )}
                  {!pickerLoading && !pickerError && (
                    <>
                      {/* Attach current folder */}
                      <button
                        className="sugg-picker-item sugg-picker-item--select-folder"
                        onClick={() => selectFolder({
                          id: pickerStack[pickerStack.length - 1].id,
                          name: pickerStack[pickerStack.length - 1].name,
                        })}
                      >
                        <span className="sugg-picker-item-icon" style={{ color: 'var(--accent)' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                        </span>
                        <span className="sugg-picker-item-name" style={{ color: 'var(--accent)' }}>
                          Attach this folder
                        </span>
                      </button>

                      {/* Sub-folders */}
                      {pickerFolders.map(folder => (
                        <button
                          key={folder.id}
                          className="sugg-picker-item"
                          onClick={() => handlePickerNavigate(folder)}
                        >
                          <span className="sugg-picker-item-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                          </span>
                          <span className="sugg-picker-item-name">{folder.name}</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--text-card-muted)' }}>
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      ))}

                      {/* Files */}
                      {pickerFiles.map(file => (
                        <button
                          key={file.id}
                          className="sugg-picker-item"
                          onClick={() => selectFile(file)}
                        >
                          <span className="sugg-picker-item-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                              <polyline points="13 2 13 9 20 9" />
                            </svg>
                          </span>
                          <span className="sugg-picker-item-name">{file.name}</span>
                        </button>
                      ))}

                      {pickerFolders.length === 0 && pickerFiles.length === 0 && (
                        <div className="sugg-picker-empty">Folder is empty</div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
