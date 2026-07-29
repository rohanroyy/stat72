import React, { useState, useEffect, useRef } from 'react';
import { listFolder } from '../../services/driveService';
import { getApiKey } from '../../config/drive';

/**
 * AddSuggestionModal
 * A bottom-sheet modal for toppers to add or edit a suggestion.
 * Props:
 *   - open: boolean
 *   - editingSuggestion: suggestion object | null (null = add mode)
 *   - foldersList: configured root drive folders
 *   - onSubmit({ text, attachment })
 *   - onClose()
 */
export default function AddSuggestionModal({ open, editingSuggestion, foldersList = [], onSubmit, onClose }) {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null); // { type, name, driveId, mimeType? }

  // Drive picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStack, setPickerStack] = useState([]); // breadcrumb stack [{ id, name }]
  const [pickerFolders, setPickerFolders] = useState([]);
  const [pickerFiles, setPickerFiles] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');

  const textRef = useRef(null);

  // Prefill when editing
  useEffect(() => {
    if (open) {
      setText(editingSuggestion?.text || '');
      setAttachment(editingSuggestion?.attachment || null);
      setPickerOpen(false);
      setPickerStack([]);
      setPickerFolders([]);
      setPickerFiles([]);
      setPickerError('');
    }
  }, [open, editingSuggestion]);

  // Focus textarea on open
  useEffect(() => {
    if (open && textRef.current) {
      setTimeout(() => textRef.current?.focus(), 100);
    }
  }, [open]);

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ── Drive picker ────────────────────────────────────────────────────────────

  const loadPickerFolder = async (folderId, folderName) => {
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
    loadPickerFolder(folder.folderId, folder.name);
  };

  const handlePickerNavigate = (folder) => {
    const newStack = [...pickerStack, { id: folder.id, name: folder.name }];
    setPickerStack(newStack);
    loadPickerFolder(folder.id, folder.name);
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
    loadPickerFolder(newStack[newStack.length - 1].id, newStack[newStack.length - 1].name);
  };

  const selectFolder = (folder) => {
    setAttachment({ type: 'folder', name: folder.name, driveId: folder.id });
    setPickerOpen(false);
    setPickerStack([]);
  };

  const selectFile = (file) => {
    setAttachment({ type: 'file', name: file.name, driveId: file.id, mimeType: file.mimeType });
    setPickerOpen(false);
    setPickerStack([]);
  };

  const clearAttachment = () => setAttachment(null);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText && !attachment) return;
    onSubmit({ text: trimmedText || null, attachment: attachment || null });
  };

  const canSubmit = text.trim() || attachment;

  if (!open) return null;

  return (
    <div className="sugg-modal-backdrop" onClick={handleBackdropClick}>
      <div className="sugg-modal-sheet">
        {/* Header */}
        <div className="sugg-modal-header">
          <span className="sugg-modal-title">
            {editingSuggestion ? 'Edit Suggestion' : 'Add Suggestion'}
          </span>
          <button className="sugg-modal-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {!pickerOpen ? (
          /* ── Main form ───────────────────────────────────────────────────── */
          <form onSubmit={handleSubmit} className="sugg-modal-body">
            <textarea
              ref={textRef}
              className="sugg-modal-textarea"
              placeholder="Write something helpful... (optional)"
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
            />

            {/* Attachment preview */}
            {attachment ? (
              <div className="sugg-attachment-preview">
                <span className="sugg-attachment-preview-icon">
                  {attachment.type === 'folder' ? (
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
                <span className="sugg-attachment-preview-name">{attachment.name}</span>
                <button
                  type="button"
                  className="sugg-attachment-remove"
                  onClick={clearAttachment}
                  aria-label="Remove attachment"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="sugg-pick-drive-btn"
                onClick={openPickerRoot}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Attach from Drive
              </button>
            )}

            <div className="sugg-modal-actions">
              <button type="button" className="sugg-cancel-btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="sugg-submit-btn" disabled={!canSubmit}>
                {editingSuggestion ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        ) : (
          /* ── Drive picker ────────────────────────────────────────────────── */
          <div className="sugg-picker-body">
            {/* Picker nav */}
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
              {/* Root: show configured root drives */}
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
                      {/* Select current folder as attachment */}
                      <button
                        className="sugg-picker-item sugg-picker-item--select-folder"
                        onClick={() => selectFolder({ id: pickerStack[pickerStack.length - 1].id, name: pickerStack[pickerStack.length - 1].name })}
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

                      {/* Files (PDF, images) */}
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
