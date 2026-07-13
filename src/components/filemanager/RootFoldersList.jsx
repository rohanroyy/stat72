import React from 'react';
import { IconFolder, IconChevronRight } from '../common/Icons';

export default function RootFoldersList({ foldersList, onSelectFolder, onOpenAdmin }) {
  return (
    <div style={{ padding: '8px 4px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 16px 8px 16px',
        }}
      >
        <div>
          <h2 className="display-l" style={{ fontSize: '24px' }}>
            Notes
          </h2>
          <p className="caption" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>
            Browse lecture materials & files
          </p>
        </div>
      </div>

      {foldersList.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div className="empty-state-icon" style={{ margin: '0 auto 16px' }}>
            <IconFolder size={28} />
          </div>
          <p className="body-l" style={{ color: 'var(--text-secondary)' }}>
            No folders configured.
          </p>
          <p className="caption" style={{ color: 'var(--text-tertiary)', marginTop: '8px', maxWidth: '280px', margin: '8px auto 0' }}>
            No Google Drive folders have been connected yet. Please contact your administrator.
          </p>
        </div>
      ) : (
        <div className="root-folders-grid">
          {foldersList.map((folder) => (
            <button
              key={folder.id}
              className="root-folder-card"
              onClick={() => onSelectFolder(folder)}
              aria-label={`Open folder ${folder.name}`}
            >
              <div className="root-folder-card-top">
                <div className="root-folder-icon-box">
                  <IconFolder size={22} />
                </div>
                <div className="root-folder-card-arrow">
                  <IconChevronRight size={18} />
                </div>
              </div>
              <div>
                <h3 className="root-folder-name" style={{ margin: 0 }}>{folder.name}</h3>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
