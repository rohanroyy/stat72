import React from 'react';

export default function BottomNav({ activeTab = 'dashboard', onChangeTab, unreadNotifCount = 0 }) {
  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      ariaLabel: 'Dashboard',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="2" />
          <rect x="14" y="3" width="7" height="5" rx="2" />
          <rect x="14" y="12" width="7" height="9" rx="2" />
          <rect x="3" y="16" width="7" height="5" rx="2" />
        </svg>
      )
    },
    {
      id: 'calendar',
      label: 'Exams',
      ariaLabel: 'Exam Schedule',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    },
    {
      id: 'materials',
      label: 'Materials',
      ariaLabel: 'Materials',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      )
    },
    {
      id: 'explore',
      label: 'Explore',
      ariaLabel: 'Explore',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      )
    },
    {
      id: 'announcement',
      label: 'Notification',
      ariaLabel: 'Notification',
      hasBadge: unreadNotifCount > 0,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      )
    }
  ];

  return (
    <div className="bottom-nav-wrapper">
      <nav className="bottom-nav-capsule" aria-label="Main navigation">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`capsule-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onChangeTab(tab.id)}
              aria-label={tab.ariaLabel}
              id={`nav-${tab.id}`}
            >
              <span className="capsule-icon-wrap" style={{ position: 'relative' }}>
                {tab.icon}
                {tab.hasBadge && <span className="capsule-notif-badge" />}
              </span>
              <span className="capsule-label-wrap">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
