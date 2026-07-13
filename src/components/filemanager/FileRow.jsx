import React from 'react';
import { IconPdf, IconImage, IconVideo, IconFile } from '../common/Icons';

function FileIcon({ fileType }) {
  switch (fileType) {
    case 'pdf': return <IconPdf size={22} />;
    case 'image': return <IconImage size={22} />;
    case 'video': return <IconVideo size={22} />;
    default: return <IconFile size={22} />;
  }
}

export default function FileRow({ file, onClick }) {
  return (
    <button
      className="file-row"
      data-type={file.fileType}
      onClick={() => onClick(file)}
      aria-label={`Open ${file.name}`}
    >
      <div className="file-icon-wrap" data-type={file.fileType}>
        <FileIcon fileType={file.fileType} />
        <span className="file-type-badge">{file.typeLabel}</span>
      </div>
      <div className="file-info">
        <div className="file-name" title={file.name}>{file.name}</div>
        <div className="file-meta">
          {file.formattedSize && file.formattedSize !== '-' && (
            <>
              <span>{file.formattedSize}</span>
              <span className="file-meta-divider" />
            </>
          )}
          {file.formattedDate && (
            <span>{file.formattedDate}</span>
          )}
          {file.extension && (
            <>
              <span className="file-meta-divider" />
              <span>.{file.extension}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}
