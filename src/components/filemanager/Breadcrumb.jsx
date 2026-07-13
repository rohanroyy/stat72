import React from 'react';
import { IconFolder, IconChevronRight } from '../common/Icons';

export default function Breadcrumb({ breadcrumbs, onNavigate }) {
  if (breadcrumbs.length <= 1) return null;

  return (
    <div className="breadcrumb" role="navigation" aria-label="Folder path">
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        return (
          <React.Fragment key={crumb.id}>
            {index > 0 && (
              <span className="breadcrumb-separator">
                <IconChevronRight size={12} />
              </span>
            )}
            <button
              className={`breadcrumb-item ${isLast ? 'active' : ''}`}
              onClick={() => !isLast && onNavigate(index)}
              disabled={isLast}
              aria-current={isLast ? 'page' : undefined}
            >
              {index === 0 && <IconFolder size={12} />}
              {crumb.name}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
