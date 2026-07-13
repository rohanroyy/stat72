import React from 'react';

export default function AnnouncementPage() {
  return (
    <div style={{ padding: '24px 20px', minHeight: 'calc(100vh - 80px)', background: 'var(--bg-base)' }}>
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <h2 className="display-l" style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>
          Announcements
        </h2>
        <p className="body-m" style={{ color: 'var(--text-secondary)' }}>
          No announcements yet. Check back later.
        </p>
      </div>
    </div>
  );
}
