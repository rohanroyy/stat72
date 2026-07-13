import React from 'react';
import Breadcrumb from './Breadcrumb';
import SectionLabel from './SectionLabel';
import FolderRow from './FolderRow';
import FileRow from './FileRow';
import { EmptyState, ErrorState, LoadingSkeleton } from './EmptyState';

export default function FileManager({
  folders,
  files,
  loading,
  error,
  breadcrumbs,
  folderCounts,
  onNavigateToFolder,
  onNavigateBreadcrumb,
  onNavigateBack, // New back callback
  onOpenFile,
  onRefresh,
}) {
  // Error state
  if (error && !loading) {
    return (
      <div style={{ padding: '0 8px' }}>
        <div style={{ padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="header-back-btn" onClick={onNavigateBack}>
            Back
          </button>
        </div>
        <ErrorState error={error} onRetry={onRefresh} />
      </div>
    );
  }

  // Loading state
  if (loading && folders.length === 0 && files.length === 0) {
    return (
      <div style={{ padding: '0 8px' }}>
        <div style={{ padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="header-back-btn" onClick={onNavigateBack}>
            Back
          </button>
          <span className="caption" style={{ color: 'var(--text-tertiary)' }}>Syncing folder...</span>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  const showFolders = folders.length > 0;
  const showFiles = files.length > 0;
  const isEmpty = !showFolders && !showFiles;

  // Determine current active folder name
  const currentFolderName = breadcrumbs[breadcrumbs.length - 1]?.name || 'Files';

  return (
    <div style={{ padding: '0 8px' }}>
      {/* Navigation Header */}
      <div
        style={{
          padding: '16px 16px 8px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="header-back-btn" onClick={onNavigateBack}>
            Back
          </button>
          <div>
            <h2 className="body-l" style={{ fontWeight: '600', fontSize: '18px' }}>
              {currentFolderName}
            </h2>
          </div>
        </div>
      </div>

      {/* Breadcrumb Trail */}
      <Breadcrumb breadcrumbs={breadcrumbs} onNavigate={onNavigateBreadcrumb} />

      {isEmpty ? (
        <EmptyState filter="all" />
      ) : (
        <>
          {showFolders && (
            <>
              <SectionLabel label="Folders" />
              <div className="file-list">
                {folders.map((folder) => (
                  <FolderRow
                    key={folder.id}
                    folder={folder}
                    itemCount={folderCounts[folder.id]}
                    onClick={onNavigateToFolder}
                  />
                ))}
              </div>
            </>
          )}

          {showFiles && (
            <>
              <SectionLabel label={showFolders ? 'Files' : 'All Files'} />
              <div className="file-list">
                {files.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onClick={onOpenFile}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
