import React from 'react';

export default function SectionLabel({ label }) {
  return (
    <div className="section-label">
      <span className="section-label-text">{label}</span>
      <div className="section-label-line" />
    </div>
  );
}
