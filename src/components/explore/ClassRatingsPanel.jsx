import React, { useState, useEffect } from 'react';
import { ALL_SUBJECTS, SUBJECT_META } from './ClassCountPanel';
import { getTeacherAverageRatings, subscribeToRatings, normaliseSubject } from '../../services/ratingService';

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

// ── Star Display Component (with crisp SVG gradient for half-stars) ──────────
function StarDisplay({ avg }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="crp-star-row" aria-label={`${avg} out of 5 stars`}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="crp-half-fill" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
      {stars.map((s) => {
        const filled = avg >= s;
        const half = !filled && avg >= s - 0.5;
        const fillValue = filled ? '#F59E0B' : half ? 'url(#crp-half-fill)' : 'none';
        const strokeValue = filled || half ? '#F59E0B' : '#D4D4D8';
        return (
          <svg
            key={s}
            className="crp-star-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill={fillValue}
            stroke={strokeValue}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      })}
    </div>
  );
}

// ── Main ClassRatingsPanel Component ─────────────────────────────────────────
export default function ClassRatingsPanel({ onBack }) {
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadRatings = async () => {
    try {
      const data = await getTeacherAverageRatings();
      setRatings(data || {});
    } catch (err) {
      console.error('[ClassRatingsPanel] Failed to load ratings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRatings();
    const unsub = subscribeToRatings(loadRatings);
    return () => unsub();
  }, []);

  const teacherList = ALL_SUBJECTS.map((subjectCode) => {
    const meta = SUBJECT_META[subjectCode] || {};
    const key = normaliseSubject(subjectCode);
    const ratingData = ratings[key] || null;
    return {
      subjectCode,
      subjectName: meta.name || subjectCode,
      teacher: meta.teacher || 'To be announced',
      credits: meta.credits,
      avg: ratingData ? ratingData.avg : null,
      count: ratingData ? ratingData.count : 0,
      tone: COURSE_TONES[subjectCode] || '#E8472B',
    };
  }).sort((a, b) => {
    if (a.avg !== null && b.avg === null) return -1;
    if (a.avg === null && b.avg !== null) return 1;
    if (a.avg !== null && b.avg !== null) return b.avg - a.avg;
    return a.subjectCode.localeCompare(b.subjectCode);
  });

  const totalRatings = teacherList.reduce((s, r) => s + r.count, 0);
  const ratedCount = teacherList.filter((t) => t.count > 0).length;
  const totalWeighted = teacherList.reduce((s, r) => s + (r.avg ? r.avg * r.count : 0), 0);
  const overallAvg = totalRatings > 0 ? (totalWeighted / totalRatings).toFixed(1) : null;

  return (
    <main className="ratings-catalog">
      {/* ── Obsidian Hero Header (Matching Courses Catalog Vibe) ── */}
      <header className="ratings-catalog-hero">
        <div className="ratings-catalog-nav">
          <button
            className="ratings-catalog-back"
            onClick={onBack}
            aria-label="Back to Explore"
            id="btn-ratings-back"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <span className="ratings-catalog-brand">বাহাত্তর</span>
          <span className="ratings-catalog-year">Evaluations</span>
        </div>

        <div className="ratings-catalog-intro">
          <p>Faculty feedback</p>
          <h1>Class<br /><em>ratings</em></h1>
          <span className="ratings-catalog-intro-mark" aria-hidden="true">★</span>
        </div>

        <div className="ratings-catalog-summary">
          <span><strong>{loading ? '…' : totalRatings}</strong> reviews recorded</span>
          <span>Honours · Statistics</span>
        </div>
      </header>

      <div className="ratings-catalog-content">
        {/* ── Metric Facts Strip (Matching Course Facts) ── */}
        <section className="ratings-facts" aria-label="Rating Overview">
          <div className="ratings-fact">
            <span>Total Reviews</span>
            <strong>{loading ? '…' : totalRatings}</strong>
          </div>
          <div className="ratings-fact">
            <span>Faculty Rated</span>
            <strong>{loading ? '…' : `${ratedCount} / ${teacherList.length}`}</strong>
          </div>
          <div className="ratings-fact">
            <span>Batch Avg</span>
            <strong>
              {loading ? '…' : overallAvg ? (
                <>{overallAvg} <small>/ 5.0</small></>
              ) : (
                '—'
              )}
            </strong>
          </div>
        </section>

        {/* ── Faculty Ratings Section ── */}
        <section className="ratings-group">
          <div className="ratings-group-heading">
            <div>
              <h2>Course Faculty</h2>
              <p>Ratings submitted by batch students after ended classes</p>
            </div>
            <span>{teacherList.length}</span>
          </div>

          {loading ? (
            <div className="ratings-loading-state">
              <div className="spinner" />
              <span>Loading faculty reviews…</span>
            </div>
          ) : (
            <div className="ratings-card-grid">
              {teacherList.map(({ subjectCode, subjectName, teacher, credits, avg, count, tone }) => (
                <article
                  key={subjectCode}
                  className="rating-card"
                  style={{ '--card-tone': tone }}
                >
                  <div className="rating-card-main">
                    {/* Left Column: Teacher Name, Course Name, Code & Credits */}
                    <div className="rating-card-left">
                      <h3 className="rating-teacher-name-big">{teacher}</h3>
                      <p className="rating-course-name">{subjectName}</p>
                      <div className="rating-meta-row">
                        <span className="rating-code-pill">Stat {subjectCode}</span>
                        {credits && (
                          <span className="rating-credit-pill">{credits} Credits</span>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Rating in Big Font Size */}
                    <div className="rating-card-right">
                      {avg !== null ? (
                        <div className="rating-score-block">
                          <div className="rating-big-score">
                            <span className="rating-big-num">{avg.toFixed(1)}</span>
                            <span className="rating-big-scale">/5</span>
                          </div>
                          <StarDisplay avg={avg} />
                          <span className="rating-count-sub">
                            {count} {count === 1 ? 'review' : 'reviews'}
                          </span>
                        </div>
                      ) : (
                        <div className="rating-unrated-block">
                          <span className="rating-unrated-dash">—</span>
                          <span className="rating-unrated-text">No ratings yet</span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ── Footer Note ── */}
        <footer className="ratings-footer-note">
          <div className="ratings-footer-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <p>
            Ratings are submitted by students on their daily class dashboard.
            Averages update in real time for transparent batch feedback.
          </p>
        </footer>
      </div>
    </main>
  );
}
