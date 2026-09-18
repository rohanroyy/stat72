import React from 'react';
import { SUBJECT_META } from './ClassCountPanel';

const COURSE_GROUPS = [
  { label: 'Core courses', description: 'Theory and applied statistics', codes: ['H-401', 'H-402', 'H-403', 'H-404', 'H-405', 'H-406', 'H-407', 'H-408'] },
  { label: 'Practical & assessment', description: 'Computing, project and viva', codes: ['H-409', 'H-410', 'H-411', 'H-412', 'H-413'] },
];

const COURSE_TONES = {
  'H-401': '#4C9EEB', 'H-402': '#8B5CF6', 'H-403': '#8B5CF6', 'H-404': '#E8472B', 'H-405': '#F59E0B', 'H-406': '#EC4899', 'H-407': '#4C9EEB', 'H-408': '#E8472B', 'H-409': '#10B981', 'H-410': '#10B981', 'H-411': '#10B981', 'H-412': '#6B7280', 'H-413': '#6B7280',
};

export default function CoursesPanel({ onBack, onSelectCourse }) {
  const totalCourses = COURSE_GROUPS.reduce((total, group) => total + group.codes.length, 0);
  return (
    <main className="course-catalog">
      <header className="course-catalog-hero">
        <div className="course-catalog-nav">
          <button className="course-catalog-back" onClick={onBack} aria-label="Back to Explore"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
          <span className="course-catalog-brand">বাহাত্তর</span><span className="course-catalog-year">4th year</span>
        </div>
        <div className="course-catalog-intro"><p>Academic space</p><h1>Course<br /><em>catalog</em></h1><span className="course-catalog-intro-mark" aria-hidden="true">72</span></div>
        <div className="course-catalog-summary"><span><strong>{totalCourses}</strong> courses</span><span>Honours · Statistics</span></div>
      </header>
      <div className="course-catalog-content">
        {COURSE_GROUPS.map((group) => (
          <section className="course-group" key={group.label} aria-labelledby={`group-${group.label}`}>
            <div className="course-group-heading"><div><h2 id={`group-${group.label}`}>{group.label}</h2><p>{group.description}</p></div><span>{group.codes.length}</span></div>
            <div className="course-tile-grid">
              {group.codes.map((code) => {
                const meta = SUBJECT_META[code] || {}; const tone = COURSE_TONES[code] || '#E8472B';
                return <button key={code} className="course-tile" onClick={() => onSelectCourse({ code, tone, ...meta })} aria-label={`Open Stat ${code}: ${meta.name || code}`}>
                  <span className="course-tile-code">STAT<br />{code.replace('H-', '')}</span><span className="course-tile-arrow" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg></span><span className="course-tile-name">{meta.name || code}</span><span className="course-tile-meta">{meta.credits} credits</span>
                </button>;
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
