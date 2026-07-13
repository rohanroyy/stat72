import React from 'react';

export default function BottomNav({ activeTab = 'calendar', onChangeTab }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {/* 1. Exam Calendar */}
      <button
        className={`nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
        onClick={() => onChangeTab('calendar')}
        aria-label="Exam Schedule"
        id="nav-calendar"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8"  y1="2" x2="8"  y2="6" />
          <line x1="3"  y1="10" x2="21" y2="10" />
        </svg>
        <span>Exams</span>
      </button>

      {/* 2. Drive Files */}
      <button
        className={`nav-item ${activeTab === 'files' ? 'active' : ''}`}
        onClick={() => onChangeTab('files')}
        aria-label="Browse Drive Files"
        id="nav-files"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>Drive Files</span>
      </button>

      {/* 3. Telegram */}
      <button
        className={`nav-item ${activeTab === 'telegram' ? 'active' : ''}`}
        onClick={() => onChangeTab('telegram')}
        aria-label="Telegram files"
        id="nav-telegram"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
        <span>Telegram</span>
      </button>

      {/* 4. Announcement */}
      <button
        className={`nav-item ${activeTab === 'announcement' ? 'active' : ''}`}
        onClick={() => onChangeTab('announcement')}
        aria-label="Announcements"
        id="nav-announcement"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        <span>Announcement</span>
      </button>
    </nav>
  );
}
