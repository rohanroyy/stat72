import React from 'react';

export default function AnnouncementPage() {
  return (
    <div className="announcements-container">
      <div className="announcements-header">
        <h2>Announcements</h2>
        <p>Stay updated with academic notices, exam registrations, and session updates.</p>
      </div>
      <div className="announcements-placeholder">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <h3>No notices found</h3>
        <p>Check back later for official announcements and schedules.</p>
      </div>
    </div>
  );
}
