import React from 'react';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pdf', label: 'PDFs' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Videos' },
  { key: 'folder', label: 'Folders' },
];

export default function FilterPills({
  activeFilter,
  onFilterChange,
  fileCounts = {},
}) {
  return (
    <div className="filter-pills" role="tablist" aria-label="Filter files">
      {FILTERS.map((filter) => {
        const count = fileCounts[filter.key];
        const isActive = activeFilter === filter.key;

        return (
          <button
            key={filter.key}
            className={`filter-pill ${isActive ? 'active' : ''}`}
            data-filter={filter.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onFilterChange(filter.key)}
          >
            {filter.label}
            {count !== undefined && count > 0 && (
              <span className="filter-pill-count">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
