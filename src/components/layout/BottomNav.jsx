import React from 'react';

export default function BottomNav({ activeTab = 'dashboard', onChangeTab }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {/* 1. Dashboard */}
      <button
        className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => onChangeTab('dashboard')}
        aria-label="Dashboard"
        id="nav-dashboard"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" />
          <rect x="14" y="3" width="7" height="5" />
          <rect x="14" y="12" width="7" height="9" />
          <rect x="3" y="16" width="7" height="5" />
        </svg>
        <span>Dashboard</span>
      </button>

      {/* 2. Exam Calendar */}
      <button
        className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
        onClick={() => onChangeTab('calendar')}
        aria-label="Exam Schedule"
        id="nav-calendar"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8"  y1="2" x2="8"  y2="6" />
          <line x1="3"  y1="10" x2="21" y2="10" />
        </svg>
        <span>Exams</span>
      </button>

      {/* 3. Materials */}
      <button
        className={`nav-item ${activeTab === 'materials' ? 'active' : ''}`}
        onClick={() => onChangeTab('materials')}
        aria-label="Materials"
        id="nav-materials"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
        <span>Materials</span>
      </button>

      {/* 4. Explore */}
      <button
        className={`nav-item ${activeTab === 'explore' ? 'active' : ''}`}
        onClick={() => onChangeTab('explore')}
        aria-label="Explore"
        id="nav-explore"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
        <span>Explore</span>
      </button>

      {/* 5. Announcement */}
      <button
        className={`nav-item ${activeTab === 'announcement' ? 'active' : ''}`}
        onClick={() => onChangeTab('announcement')}
        aria-label="Announcements"
        id="nav-announcement"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span>Notice</span>
      </button>
    </nav>
  );
}
