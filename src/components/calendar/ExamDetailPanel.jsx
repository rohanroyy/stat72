import React, { useState, useEffect, useCallback, useRef } from 'react';
import SuggestionCard from './SuggestionCard';
import AddSuggestionModal from './AddSuggestionModal';
import SuggestionFolderViewer from './SuggestionFolderViewer';
import {
  fetchSuggestions,
  addSuggestion,
  editSuggestion,
  deleteSuggestion,
  subscribeToSuggestions,
} from '../../services/suggestionService';
import { getFileType, deleteFileFromDrive } from '../../services/driveService';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatExamDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * ExamDetailPanel
 * Full-screen panel shown when clicking an exam card.
 * Props:
 *   - exam: exam object
 *   - currentUser: logged-in student object
 *   - topperIds: string[] — student IDs with topper access
 *   - foldersList: configured root drive folders for picker
 *   - onClose()
 */
export default function ExamDetailPanel({ exam, currentUser, topperIds = [], foldersList = [], onOpenFile, suggestionUploadFolder = '', highlightSuggId = null, onClose }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [openFolder, setOpenFolder] = useState(null); // { driveId, name } — folder to browse

  const isTopper = currentUser && topperIds.includes(currentUser.id);

  // ── Load suggestions ─────────────────────────────────────────────────────────
  const loadSuggestions = useCallback(async () => {
    if (!exam?.id) return;
    try {
      const data = await fetchSuggestions(exam.id);
      setSuggestions(data);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    } finally {
      setLoading(false);
    }
  }, [exam?.id]);

  useEffect(() => {
    setLoading(true);
    setSuggestions([]);
    loadSuggestions();
  }, [loadSuggestions]);

  // Realtime subscription
  useEffect(() => {
    if (!exam?.id) return;
    const unsub = subscribeToSuggestions(exam.id, loadSuggestions);
    return unsub;
  }, [exam?.id, loadSuggestions]);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // ── Browser back support ─────────────────────────────────────────────────────
  useEffect(() => {
    // Push a new history entry so browser back / device back closes the panel
    window.history.pushState({ examPanel: true, examId: exam?.id }, '');

    const onPopState = (e) => {
      // Close only if we pop to a state outside the exam detail hierarchy
      const isExamSubState = e.state && (
        e.state.examPanel ||
        e.state.suggFolderViewer ||
        e.state.viewerOpen
      );
      if (!isExamSubState) {
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [exam?.id]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleBack = () => {
    // Go back in history (triggers popstate → onClose)
    window.history.back();
  };

  const handleAddClick = () => {
    setEditingSuggestion(null);
    setModalOpen(true);
  };

  const handleEditClick = (suggestion) => {
    setEditingSuggestion(suggestion);
    setModalOpen(true);
  };

  const handleDeleteClick = (suggestion) => {
    setDeleteConfirm(suggestion);
  };

  const handleModalSubmit = async ({ text, attachments }) => {
    if (!currentUser) return;
    try {
      let updated;
      if (editingSuggestion) {
        updated = await editSuggestion(exam.id, editingSuggestion.id, { text, attachments });
      } else {
        updated = await addSuggestion(exam.id, { text, attachments }, currentUser);
      }
      setSuggestions(updated);
    } catch (err) {
      console.error('Failed to save suggestion:', err);
    } finally {
      setModalOpen(false);
      setEditingSuggestion(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      // Collect attachments that were uploaded from device (uploaded: true)
      // These files live in the admin's Drive upload folder and should be cleaned up.
      // Drive-picker selections are NOT deleted — they belong to the user's existing Drive.
      const attachmentList = Array.isArray(deleteConfirm.attachment)
        ? deleteConfirm.attachment
        : deleteConfirm.attachment
          ? [deleteConfirm.attachment]
          : [];
      const uploadedFiles = attachmentList.filter(a => a?.uploaded && a?.driveId);

      // Delete uploaded files from Drive in parallel (best-effort; don't block on failure)
      if (uploadedFiles.length > 0) {
        await Promise.allSettled(
          uploadedFiles.map(a => deleteFileFromDrive(a.driveId))
        );
      }

      const updated = await deleteSuggestion(exam.id, deleteConfirm.id);
      setSuggestions(updated);
    } catch (err) {
      console.error('Failed to delete suggestion:', err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleAttachmentClick = (attachment) => {
    if (!attachment?.driveId) return;

    if (attachment.type === 'folder') {
      // Open in the app's built-in folder viewer (same as Materials section)
      setOpenFolder({ driveId: attachment.driveId, name: attachment.name });
    } else {
      // Build a Drive file object — let the viewer call getViewUrl itself
      const fileType = getFileType(attachment.mimeType);
      const fileObj = {
        id: attachment.driveId,
        name: attachment.name,
        mimeType: attachment.mimeType || '',
        fileType,
      };
      if (onOpenFile) {
        onOpenFile(fileObj);
      } else {
        window.open(`https://drive.google.com/file/d/${attachment.driveId}/view`, '_blank');
      }
    }
  };

  if (!exam) return null;

  const isPast = exam.date < new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="exam-detail-panel">
        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="edp-header">
          <button className="edp-back-btn" onClick={handleBack} aria-label="Go back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        <div className="edp-scroll">
          {/* ── Exam Info ────────────────────────────────────────────────────── */}
          <div className="edp-exam-block">
            {isPast && <span className="edp-past-badge">Past</span>}
            <h1 className="edp-exam-name">{exam.subject}</h1>
            <p className="edp-exam-date">{formatExamDate(exam.date)}</p>

            {(exam.time || exam.duration || exam.room || exam.notes) && (
              <div className="edp-exam-meta-grid">
                {exam.time && (
                  <div className="edp-meta-item">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>{exam.time}</span>
                  </div>
                )}
                {exam.duration && (
                  <div className="edp-meta-item">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 3h14" /><path d="M19 3v4" /><path d="M5 3v4" />
                      <path d="M12 12v4" /><path d="M9.5 9.5 12 12l2.5-2.5" />
                      <rect x="2" y="7" width="20" height="14" rx="2" />
                    </svg>
                    <span>{exam.duration}</span>
                  </div>
                )}
                {exam.room && (
                  <div className="edp-meta-item">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{exam.room}</span>
                  </div>
                )}
                {exam.notes && (
                  <div className="edp-meta-item edp-meta-item--full">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6" />
                      <line x1="8" y1="12" x2="21" y2="12" />
                      <line x1="8" y1="18" x2="21" y2="18" />
                      <line x1="3" y1="6" x2="3.01" y2="6" />
                      <line x1="3" y1="12" x2="3.01" y2="12" />
                      <line x1="3" y1="18" x2="3.01" y2="18" />
                    </svg>
                    <span>{exam.notes}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Suggestions Section ────────────────────────────────────────── */}
          <div className="edp-suggestions-section">
            <div className="edp-suggestions-header">
              <span className="edp-suggestions-label">Suggestions</span>
              {isTopper && (
                <button className="edp-add-suggestion-btn" onClick={handleAddClick}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add
                </button>
              )}
            </div>

            {loading ? (
              <div className="edp-sugg-loading">
                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="edp-sugg-empty">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p>No suggestions yet.</p>
                <p className="edp-sugg-empty-sub">Ask your class topper to add suggestions in Bahattor.</p>
              </div>
            ) : (
              <div className="edp-sugg-list">
                {suggestions.map(sugg => (
                  <SuggestionCard
                    key={sugg.id}
                    suggestion={sugg}
                    examId={exam.id}
                    currentUserId={currentUser?.id}
                    isHighlighted={sugg.id === highlightSuggId}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                    onAttachmentClick={handleAttachmentClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add/Edit Suggestion Modal ──────────────────────────────────────── */}
      <AddSuggestionModal
        open={modalOpen}
        editingSuggestion={editingSuggestion}
        foldersList={foldersList}
        suggestionUploadFolder={suggestionUploadFolder}
        onSubmit={handleModalSubmit}
        onClose={() => { setModalOpen(false); setEditingSuggestion(null); }}
      />

      {/* ── Delete confirmation ────────────────────────────────────────────────── */}
      {deleteConfirm && (() => {
        // Count uploaded files that will also be removed from Drive
        const dcAttachments = Array.isArray(deleteConfirm.attachment)
          ? deleteConfirm.attachment
          : deleteConfirm.attachment ? [deleteConfirm.attachment] : [];
        const uploadedCount = dcAttachments.filter(a => a?.uploaded).length;
        return (
          <div className="sugg-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
            <div className="sugg-confirm-sheet" onClick={e => e.stopPropagation()}>
              <p className="sugg-confirm-text">Remove this suggestion?</p>
              {uploadedCount > 0 && (
                <p style={{
                  fontSize: '12px',
                  color: 'var(--accent)',
                  margin: '-4px 0 8px 0',
                  lineHeight: 1.5,
                }}>
                  {uploadedCount} uploaded file{uploadedCount > 1 ? 's' : ''} will be permanently deleted.
                </p>
              )}
              <div className="sugg-confirm-actions">
                <button className="sugg-cancel-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="sugg-submit-btn sugg-submit-btn--danger" onClick={confirmDelete}>Remove</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Folder Viewer (slides over the panel) ─────────────────────────── */}
      {openFolder && (
        <SuggestionFolderViewer
          folder={openFolder}
          onOpenFile={onOpenFile}
          onClose={() => setOpenFolder(null)}
        />
      )}
    </>
  );
}
