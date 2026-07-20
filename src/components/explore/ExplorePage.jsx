import React from 'react';

export default function ExplorePage() {
  const exploreItems = [
    {
      title: 'Batch Directory',
      desc: 'Connect with all batchmates from Batch 72. Browse contacts, sessions, and profiles.',
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
      tag: 'Coming Soon',
    },
    {
      title: 'CGPA Calculator',
      desc: 'Track and estimate your term-by-term GPA and overall cumulative GPA for DU courses.',
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <line x1="9" y1="22" x2="9" y2="16" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="16" y1="12" x2="16" y2="16" />
          <line x1="12" y1="12" x2="12" y2="16" />
          <line x1="8" y1="12" x2="8" y2="13" />
        </svg>
      ),
      tag: 'Coming Soon',
    },
    {
      title: 'Alumni Directory',
      desc: 'Explore career networks, profiles, and job opportunities shared by our batch graduates.',
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
        </svg>
      ),
      tag: 'Planning',
    },
    {
      title: 'Research Hub',
      desc: 'Browse statistics and data science publications, thesis projects, and research databases.',
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
      tag: 'Planning',
    },
  ];

  return (
    <div className="explore-container">
      <div className="explore-header">
        <h2>Explore Bahattor</h2>
        <p>Discover student utilities, academic tools, and batch networks designed for the DU Statistics family.</p>
      </div>

      <div className="explore-grid">
        {exploreItems.map((item, idx) => (
          <div key={idx} className="explore-card">
            <div className="explore-card-top">
              <div className="explore-icon">{item.icon}</div>
              <span className={`explore-tag ${item.tag.toLowerCase().replace(' ', '-')}`}>
                {item.tag}
              </span>
            </div>
            <h3 className="explore-card-title">{item.title}</h3>
            <p className="explore-card-desc">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
