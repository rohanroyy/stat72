import React, { useEffect } from 'react';
import { useDriveFolder } from '../../hooks/useDriveFolder';
import FileManager from '../filemanager/FileManager';
import { getApiKey } from '../../config/drive';

/**
 * SuggestionFolderViewer
 * Full-screen overlay that opens a Drive folder in the same file-manager
 * view used by the Materials section. Supports browser/device back to close.
 *
 * Props:
 *   - folder: { driveId, name }  — the suggested folder attachment
 *   - onOpenFile(file)           — forwarded to FileManager for file clicks
 *   - onClose()                  — close this overlay
 */
export default function SuggestionFolderViewer({ folder, onOpenFile, onClose }) {
  const apiKey = getApiKey();

  const {
    folders,
    files,
    loading,
    error,
    breadcrumbs,
    navigateToFolder,
    navigateBack,
    navigateToBreadcrumb,
    folderCounts,
    refresh,
  } = useDriveFolder(folder.driveId, folder.name, apiKey);

  // Push a history entry so browser/device back closes this viewer
  useEffect(() => {
    window.history.pushState({ suggFolderViewer: true, folderId: folder.driveId }, '');

    const onPopState = (e) => {
      if (!e.state?.suggFolderViewer) {
        onClose();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [folder.driveId, onClose]);

  const handleBack = () => {
    // Go back in history (fires popstate → onClose)
    window.history.back();
  };

  // When FileManager's back is called: go up a folder level, or close if at root
  const handleNavigateBack = () => {
    if (breadcrumbs.length > 1) {
      navigateBack();
    } else {
      handleBack();
    }
  };

  return (
    <div className="sfv-overlay">
      {/* Header bar */}
      <div className="sfv-header">
        <button className="sfv-back-btn" onClick={handleNavigateBack} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="sfv-title">
          {breadcrumbs[breadcrumbs.length - 1]?.name || folder.name}
        </span>
        <button className="sfv-refresh-btn" onClick={refresh} aria-label="Refresh" title="Refresh">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Breadcrumb strip */}
      {breadcrumbs.length > 1 && (
        <div className="sfv-breadcrumb">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <button
                className="sfv-crumb-btn"
                onClick={() => navigateToBreadcrumb(idx)}
                disabled={idx === breadcrumbs.length - 1}
              >
                {crumb.name}
              </button>
              {idx < breadcrumbs.length - 1 && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-tertiary)' }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* File Manager body — reuse exact same component as Materials */}
      <div className="sfv-body">
        <FileManager
          folders={folders}
          files={files}
          loading={loading}
          error={error}
          breadcrumbs={breadcrumbs}
          folderCounts={folderCounts}
          onNavigateToFolder={navigateToFolder}
          onNavigateBreadcrumb={navigateToBreadcrumb}
          onNavigateBack={handleNavigateBack}
          onOpenFile={onOpenFile}
          onRefresh={refresh}
        />
      </div>
    </div>
  );
}
