import React from 'react';
import { IconFolder, IconChevronRight } from '../common/Icons';

export default function FolderRow({ folder, itemCount, onClick }) {
  return (
    <button
      className="folder-row"
      onClick={() => onClick(folder.id, folder.name)}
      aria-label={`Open folder ${folder.name}`}
    >
      <div className="folder-icon">
        <IconFolder size={20} />
      </div>
      <div className="folder-info">
        <div className="folder-name">{folder.name}</div>
      </div>
      {itemCount !== undefined && (
        <span className="folder-count">{itemCount}</span>
      )}
      <span className="folder-chevron">
        <IconChevronRight size={16} />
      </span>
    </button>
  );
}
