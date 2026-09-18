import React, { useState, useEffect, useMemo } from 'react';
import { getCourseClassTotals, subscribeToConfirmations } from '../../services/classConfirmationService';

export const ALL_SUBJECTS = ['H 401', 'H 402', 'H 403', 'H-404', 'H-405', 'H 406', 'H-407', 'H 408'];

export const SUBJECT_META = {
  'H 401': { name: 'Agricultural Statistics', teacher: 'BH', room: 'R. 436' },
  'H 402': { name: 'Statistical Inference', teacher: 'FA', room: 'R. 402' },
  'H 403': { name: 'Econometrics', teacher: 'FTZ', room: 'R. 427' },
  'H-404': { name: 'Demography', teacher: 'KKS', room: 'R. 402' },
  'H-405': { name: 'Design of Experiments', teacher: 'MI', room: 'R. 402' },
  'H 406': { name: 'Operations Research', teacher: 'JAK', room: 'R. 406' },
  'H-407': { name: 'Biostatistics', teacher: 'NS', room: 'R. 402' },
  'H 408': { name: 'Computer Applications', teacher: 'JHK', room: 'R. 401' },
};

/**
 * ClassCountPanel: Pure light theme panel page matching the Explore Page vibe.
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
      const vals = Object.values(obj).map(v => Number(v) || 0);
      return vals.length > 0 ? Math.max(1, ...vals) : 1;
    } catch {
      return 1;
    }
  }, [totals]);

  return (
    <div
      className="ccp-light-panel"
      style={{
        background: '#ffffff',
        color: '#111111',
        minHeight: '85vh',
        width: '100%',
        paddingBottom: '40px',
      }}
    >
      {/* ── Navigation Header ── */}
      <div
        className="ccp-light-topbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '12px',
          borderBottom: '1px solid #f1f5f9',
          marginBottom: '16px',
        }}
      >
        <button
          className="ccp-light-back-btn"
          onClick={onBack}
          aria-label="Back to Explore"
          id="btn-ccp-back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px 8px 10px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            fontSize: '13.5px',
            fontWeight: '600',
            color: '#111111',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back</span>
        </button>

        <h2
          className="ccp-light-heading"
          style={{
            fontSize: '19px',
            fontWeight: '750',
            color: '#111111',
            margin: 0,
          }}
        >
          Class Count Board
        </h2>

        <div style={{ width: 44 }} />
      </div>

      {/* ── Summary Card ── */}
      <div
        className="ccp-light-summary-card"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(232, 71, 43, 0.1)',
              color: '#E8472B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#666666', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Classes Held
            </span>
            <span style={{ fontSize: '22px', fontWeight: '800', color: '#111111', lineHeight: '1.2' }}>
              {loading ? '…' : `${totalClasses} Classes`}
            </span>
          </div>
        </div>

        <span
          style={{
            fontSize: '11px',
            fontWeight: '700',
            color: '#10B981',
            background: 'rgba(16, 185, 129, 0.1)',
            padding: '5px 11px',
            borderRadius: '9999px',
          }}
        >
          CR Verified
        </span>
      </div>

      {/* ── Course List ── */}
      <div className="ccp-light-course-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {ALL_SUBJECTS.map((subject) => {
          const meta = SUBJECT_META[subject] || { name: 'Course', teacher: '', room: '' };
          const count = totals[subject] || 0;
          const pct = maxClasses > 0 ? Math.round((count / maxClasses) * 100) : 0;

          return (
            <div
              key={subject}
              className="ccp-light-course-card"
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#111111', letterSpacing: '0.01em' }}>
                    {subject}
                  </span>
                  <span style={{ fontSize: '13px', color: '#666666', marginLeft: '8px' }}>
                    {meta.name} {meta.teacher ? `(${meta.teacher})` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '22px', fontWeight: '800', color: '#E8472B', lineHeight: '1' }}>
                    {count}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#888888', fontWeight: '500' }}>
                    {count === 1 ? 'class' : 'classes'}
                  </span>
                </div>
              </div>

              {/* Progress Track */}
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  background: '#f1f5f9',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(count > 0 ? 6 : 0, pct)}%`,
                    background: 'linear-gradient(90deg, #E8472B, #F07055)',
                    borderRadius: '9999px',
                    transition: 'width 0.6s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Brief Info Note ── */}
      <div
        className="ccp-light-info-note"
        style={{
          marginTop: '16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '12px',
          color: '#666666',
          lineHeight: '1.5',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8472B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          Confirmed by CRs after class ends. Single slot = 1 class, double slot = 2 classes.
        </span>
      </div>
    </div>
  );
}
