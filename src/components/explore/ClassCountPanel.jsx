import React, { useState, useEffect, useMemo } from 'react';
import { getCourseClassTotals, subscribeToConfirmations } from '../../services/classConfirmationService';

export const ALL_SUBJECTS = [
  'H-401', 'H-402', 'H-403', 'H-404', 'H-405', 'H-406', 'H-407', 'H-408'
];

export const SUBJECT_META = {
  'H-401': { name: 'Multivariate Analysis', teacher: 'BH', room: 'R. 436', credits: 3 },
  'H-402': { name: 'Time Series Analysis', teacher: 'FA', room: 'R. 402', credits: 3 },
  'H-403': { name: 'Design and Analysis of Experiment', teacher: 'FTZ', room: 'R. 427', credits: 3 },
  'H-404': { name: 'Econometrics', teacher: 'KKS', room: 'R. 402', credits: 4 },
  'H-405': { name: 'Survival Analysis', teacher: 'MI', room: 'R. 402', credits: 3 },
  'H-406': { name: 'Stochastic Process', teacher: 'JAK', room: 'R. 406', credits: 3 },
  'H-407': { name: 'Generalized Linear Models', teacher: 'NS', room: 'R. 402', credits: 3 },
  'H-408': { name: 'Comprehensive', teacher: 'JHK', room: 'R. 401', credits: 4 },
  'H-409': { name: 'Statistical computing VII: Multivariate Analysis and Experimental Design (Using R/SAS/SPSS/STATA)', teacher: 'Lab Faculty', room: 'Lab', credits: 2 },
  'H-410': { name: 'Statistical computing VIII: Survival Analysis and Time Series Analysis (Using R/SAS/SPSS/STATA)', teacher: 'Lab Faculty', room: 'Lab', credits: 2 },
  'H-411': { name: 'Statistical Computing IX: Econometrics and Generalized Linear Models (Using R/SAS/SPSS/STATA)', teacher: 'Lab Faculty', room: 'Lab', credits: 2 },
  'H-412': { name: 'Research Project (70%+30%)', teacher: 'Project Supervisor', room: 'Dept', credits: 2 },
  'H-413': { name: 'Viva voce', teacher: 'Exam Board', room: 'Dept', credits: 2 },
};

// Also populate space aliases ('H 401', 'H 402', etc.)
Object.keys(SUBJECT_META).forEach((key) => {
  const spaceKey = key.replace('-', ' ');
  if (!SUBJECT_META[spaceKey]) {
    SUBJECT_META[spaceKey] = SUBJECT_META[key];
  }
});

/**
 * Robust course metadata resolver that handles any variation
 * (e.g., 'H-401', 'H 401', 'Stat H-401', '401', 'h401')
 */
export const getSubjectMeta = (code = '') => {
  if (!code) return {};
  if (SUBJECT_META[code]) return SUBJECT_META[code];
  const clean = String(code).replace(/^stat\s*/i, '').replace(/[\s-]/g, '').toLowerCase();
  let matchedKey = Object.keys(SUBJECT_META).find((k) =>
    k.replace(/^stat\s*/i, '').replace(/[\s-]/g, '').toLowerCase() === clean
  );
  if (!matchedKey) {
    const numMatch = clean.match(/\d{3}/);
    if (numMatch) {
      matchedKey = Object.keys(SUBJECT_META).find((k) => k.includes(numMatch[0]));
    }
  }
  return matchedKey ? SUBJECT_META[matchedKey] : {};
};

const COURSE_TONES = {
  'H-401': '#4C9EEB',
  'H-402': '#8B5CF6',
  'H-403': '#8B5CF6',
  'H-404': '#E8472B',
  'H-405': '#F59E0B',
  'H-406': '#EC4899',
  'H-407': '#4C9EEB',
  'H-408': '#E8472B',
};

/**
 * ClassCountPanel: Redesigned with the signature obsidian hero header,
 * metric overview facts, and cohesive course card vibe.
 */
export default function ClassCountPanel({ onBack, initialTotals = {} }) {
  const [totals, setTotals] = useState(initialTotals || {});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadTotals = async () => {
    try {
      const data = await getCourseClassTotals();
      if (data && typeof data === 'object') {
        setTotals(data);
      }
    } catch (err) {
      console.error('[ClassCountPanel] Failed to fetch totals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTotals();
    let unsub = () => {};
    try {
      unsub = subscribeToConfirmations(() => {
        loadTotals();
      }) || (() => {});
    } catch (e) {
      console.error('[ClassCountPanel] Realtime subscribe error:', e);
    }
    return () => {
      try { unsub(); } catch (_) {}
    };
  }, []);

  const totalClasses = useMemo(() => {
    try {
      const obj = totals && typeof totals === 'object' ? totals : {};
      return Object.values(obj).reduce((sum, val) => sum + (Number(val) || 0), 0);
    } catch {
      return 0;
    }
  }, [totals]);

  const maxClasses = useMemo(() => {
    try {
      const obj = totals && typeof totals === 'object' ? totals : {};
      const vals = Object.values(obj).map((v) => Number(v) || 0);
      return vals.length > 0 ? Math.max(1, ...vals) : 1;
    } catch {
      return 1;
    }
  }, [totals]);

  const activeCoursesCount = useMemo(() => {
    return ALL_SUBJECTS.filter((s) => (totals[s] || 0) > 0).length;
  }, [totals]);

  return (
    <main className="count-catalog">
      {/* ── Obsidian Hero Header (Matching Courses & Ratings Catalog Vibe) ── */}
      <header className="count-catalog-hero">
        <div className="count-catalog-nav">
          <button
            className="count-catalog-back"
            onClick={onBack}
            aria-label="Back to Explore"
            id="btn-count-back"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <span className="count-catalog-brand">বাহাত্তর</span>
          <span className="count-catalog-year">Attendance</span>
        </div>

        <div className="count-catalog-intro">
          <p>Class logs</p>
          <h1>Class<br /><em>count</em></h1>
          <span className="count-catalog-intro-mark" aria-hidden="true">#</span>
        </div>

        <div className="count-catalog-summary">
          <span><strong>{loading ? '…' : totalClasses}</strong> classes conducted</span>
          <span>CR Verified · 4th Year</span>
        </div>
      </header>

      <div className="count-catalog-content">
        {/* ── Metric Facts Strip (Matching Course Facts) ── */}
        <section className="count-facts" aria-label="Attendance Overview">
          <div className="count-fact">
            <span>Total Classes</span>
            <strong>{loading ? '…' : totalClasses}</strong>
          </div>
          <div className="count-fact">
            <span>Active Courses</span>
            <strong>{loading ? '…' : `${activeCoursesCount} / ${ALL_SUBJECTS.length}`}</strong>
          </div>
        </section>

        {/* ── Course Class Counts List ── */}
        <section className="count-group">
          <div className="count-group-heading">
            <div>
              <h2>Core Courses</h2>
              <p>Confirmed class sessions recorded by Class Representatives</p>
            </div>
            <span>{ALL_SUBJECTS.length}</span>
          </div>

          <div className="count-card-grid">
            {ALL_SUBJECTS.map((subject) => {
              const meta = SUBJECT_META[subject] || { name: 'Course', teacher: '', room: '', credits: 3 };
              const count = totals[subject] || 0;
              const pct = maxClasses > 0 ? Math.round((count / maxClasses) * 100) : 0;
              const tone = COURSE_TONES[subject] || '#E8472B';

              return (
                <article
                  key={subject}
                  className="count-card"
                  style={{ '--card-tone': tone }}
                >
                  <div className="count-card-main">
                    {/* Left details */}
                    <div className="count-card-left">
                      <h3 className="count-course-code">Stat {subject}</h3>
                      <p className="count-course-name">{meta.name}</p>
                      <div className="count-meta-row">
                        <span className="count-instructor-pill">
                          {meta.teacher || 'TBD'}
                        </span>
                        {meta.room && (
                          <span className="count-room-pill">{meta.room}</span>
                        )}
                        {meta.credits && (
                          <span className="count-credit-pill">{meta.credits} Credits</span>
                        )}
                      </div>
                    </div>

                    {/* Right big count number */}
                    <div className="count-card-right">
                      <span className="count-big-num" style={{ color: tone }}>{count}</span>
                      <span className="count-num-label">{count === 1 ? 'class' : 'classes'}</span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="count-progress-wrap" aria-label={`${count} classes held`}>
                    <div
                      className="count-progress-fill"
                      style={{
                        width: `${Math.max(count > 0 ? 6 : 0, pct)}%`,
                        background: tone,
                      }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Footer Info Note ── */}
        <footer className="count-footer-note">
          <div className="count-footer-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <p>
            Confirmed by Class Representatives following each completed class session.
            Single slot = 1 class, double slot = 2 classes.
          </p>
        </footer>
      </div>
    </main>
  );
}
