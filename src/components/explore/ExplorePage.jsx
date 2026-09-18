import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import GlimpseViewerTray from '../glimpse/GlimpseViewerTray';
import { getCourseClassTotals, subscribeToConfirmations } from '../../services/classConfirmationService';
import ClassCountPanel from './ClassCountPanel';

/**
 * FloatingMoodBubble — two-layer architecture
 */
function FloatingMoodBubble({ student, style, initials }) {
  const dragLayerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0 });
  const accOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging.current) return;
      e.preventDefault();

      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;
      if (clientX == null || clientY == null) return;

      const dx = clientX - dragStart.current.mouseX;
      const dy = clientY - dragStart.current.mouseY;

      const nx = accOffset.current.x + dx;
      const ny = accOffset.current.y + dy;

      const el = dragLayerRef.current;
      if (el) el.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
    };

    const handleEnd = (e) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      const clientX = e.clientX ?? e.changedTouches?.[0]?.clientX;
      const clientY = e.clientY ?? e.changedTouches?.[0]?.clientY;

      if (clientX != null && clientY != null) {
        accOffset.current = {
          x: accOffset.current.x + (clientX - dragStart.current.mouseX),
          y: accOffset.current.y + (clientY - dragStart.current.mouseY),
        };
      }

      const el = dragLayerRef.current;
      if (el) {
        el.style.cursor = 'grab';
      }
    };

    window.addEventListener('mousemove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    window.addEventListener('touchcancel', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('touchcancel', handleEnd);
    };
  }, []);

  const handleStart = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();

    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX == null || clientY == null) return;

    isDragging.current = true;
    dragStart.current = { mouseX: clientX, mouseY: clientY };

    const el = dragLayerRef.current;
    if (el) el.style.cursor = 'grabbing';
  };

  return (
    <div
      className="mood-float-track"
      style={{
        position: 'absolute',
        left: style.left,
        top: style.top,
        animationName: style.animationName,
        animationDuration: style.animationDuration,
        animationDelay: style.animationDelay,
        animationIterationCount: 'infinite',
        animationTimingFunction: 'ease-in-out',
        '--dx1': style['--dx1'],
        '--dy1': style['--dy1'],
        '--dx2': style['--dx2'],
        '--dy2': style['--dy2'],
        zIndex: 5,
      }}
    >
      <div
        ref={dragLayerRef}
        className="mood-bubble-wrapper"
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        style={{
          transform: 'translate3d(0px, 0px, 0)',
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div className="mood-bubble-content">
          <span className="mood-emoji-text">{student.mood}</span>
        </div>
        <div className="mood-bubble-avatar">
          {student.profile_picture ? (
            <img src={student.profile_picture} alt={student.name} draggable={false} />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div className="mood-bubble-tooltip">{student.name}</div>
      </div>
    </div>
  );
}

// ── Main Explore Page ─────────────────────────────────────────────────────────
export default function ExplorePage({ currentUser: propUser }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bubbleStyles, setBubbleStyles] = useState([]);
  const [currentStudent, setCurrentStudent] = useState(propUser || null);

  // Dedicated panel state
  const [showClassCountPanel, setShowClassCountPanel] = useState(false);
  const [totals, setTotals] = useState({});

  useEffect(() => {
    if (!currentStudent) {
      try {
        const stored = localStorage.getItem('bahattor_logged_in_student');
        if (stored) setCurrentStudent(JSON.parse(stored));
      } catch (_) { }
    }
  }, [currentStudent]);

  // Pre-load totals & subscribe to realtime updates
  useEffect(() => {
    let mounted = true;
    const loadTotals = async () => {
      try {
        const t = await getCourseClassTotals();
        if (mounted && t && typeof t === 'object') setTotals(t);
      } catch (e) {
        console.error('[ExplorePage] Failed to load course totals:', e);
      }
    };

    loadTotals();
    let unsub = () => {};
    try {
      unsub = subscribeToConfirmations(() => {
        loadTotals();
      }) || (() => {});
    } catch (_) {}

    return () => {
      mounted = false;
      try { unsub(); } catch (_) {}
    };
  }, []);

  useEffect(() => {
    async function loadMoods() {
      try {
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from('students')
            .select('id, name, mood, profile_picture, mood_selected_at')
            .not('mood', 'is', null);
          if (error) throw error;

          const activeMoods = (data || []).filter(s => {
            if (!s.mood_selected_at) return false;
            return (now - new Date(s.mood_selected_at).getTime()) < twentyFourHours;
          });
          setStudents(activeMoods);
        } else {
          const rawMock = localStorage.getItem('bahattor_mock_students') || '[]';
          const mockStudents = JSON.parse(rawMock);
          const activeMoods = mockStudents.filter(s => {
            if (!s.mood) return false;
            if (!s.mood_selected_at) return false;
            return (now - new Date(s.mood_selected_at).getTime()) < twentyFourHours;
          });
          setStudents(activeMoods);
        }
      } catch (err) {
        console.error('Failed to load explore page moods:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMoods();
  }, []);

  const [boardWidth, setBoardWidth] = useState(window.innerWidth);

  useEffect(() => {
    const el = document.querySelector('.explore-moods-board');
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setBoardWidth(entry.contentRect.width || window.innerWidth);
      }
    });
    ro.observe(el);
    setBoardWidth(el.offsetWidth || window.innerWidth);
    return () => ro.disconnect();
  }, [loading]);

  const COLS    = boardWidth >= 600 ? 6 : 3;
  const CELL_W  = Math.floor(boardWidth / COLS);
  const CELL_H  = 110;
  const BUB_W   = 100;
  const BUB_H   = 90;

  useEffect(() => {
    if (students.length === 0) return;

    const JITTER = 8;

    const styles = students.map((_, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);

      const bx = col * CELL_W + (CELL_W - BUB_W) / 2 + (Math.floor(Math.random() * JITTER * 2) - JITTER);
      const by = row * CELL_H + (CELL_H - BUB_H) / 2 + (Math.floor(Math.random() * JITTER * 2) - JITTER);

      const speed    = 14 + (idx * 4) % 12;
      const delay    = -((idx * 3) % 15);
      const animIdx  = (idx % 3) + 1;

      return {
        left: `${Math.max(0, bx)}px`,
        top:  `${Math.max(0, by)}px`,
        animationName:     `float-drift-${animIdx}`,
        animationDuration: `${speed}s`,
        animationDelay:    `${delay}s`,
        '--dx1': `${Math.floor(Math.random() * 16) - 8}px`,
        '--dy1': `${Math.floor(Math.random() * 16) - 8}px`,
        '--dx2': `${Math.floor(Math.random() * 16) - 8}px`,
        '--dy2': `${Math.floor(Math.random() * 16) - 8}px`,
      };
    });

    setBubbleStyles(styles);
  }, [students, boardWidth, COLS, CELL_W]);

  const boardHeight = students.length === 0
    ? 180
    : Math.max(180, Math.ceil(students.length / COLS) * CELL_H + 20);

  // If the Class Counting Board panel is opened, render it in pure light theme
  if (showClassCountPanel) {
    return (
      <div
        className="explore-container"
        style={{
          background: '#ffffff',
          minHeight: '100vh',
          width: '100%',
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        <ClassCountPanel
          onBack={() => setShowClassCountPanel(false)}
          initialTotals={totals}
        />
      </div>
    );
  }

  return (
    <div className="explore-container" style={{ background: '#ffffff', minHeight: '100vh' }}>
      <div className="explore-header">
        <h2>Explore বাহাত্তর</h2>
      </div>

      {/* Section 1: Moods Board */}
      <div className="explore-section">
        <span className="section-label-text">How's the Batch feeling today?</span>
        <div className="section-label-line" />

        <div className="explore-moods-board" style={{ height: `${boardHeight}px` }}>
          {loading ? (
            <div className="moods-loading">
              <div className="spinner" />
              <span>Loading batch moods...</span>
            </div>
          ) : students.length > 0 ? (
            <div className="moods-float-container">
              {students.map((student, idx) => {
                const initials = student.name
                  ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                  : 'ST';
                return (
                  <FloatingMoodBubble
                    key={student.id || idx}
                    student={student}
                    style={bubbleStyles[idx] || {}}
                    initials={initials}
                  />
                );
              })}
            </div>
          ) : (
            <div className="moods-empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
              <h3>No moods shared yet today</h3>
              <p>Be the first to set your mood from the dashboard!</p>
            </div>
          )}
        </div>
      </div>

      {/* Section 1.5: Glimpse Photo Viewing Option Tray */}
      <GlimpseViewerTray currentStudent={currentStudent} />

      {/* Section 2: Orange Theme Class Count Board Card */}
      <div className="explore-section">
        <div
          className="explore-class-count-card-orange"
          onClick={() => setShowClassCountPanel(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowClassCountPanel(true);
            }
          }}
          aria-label="Open Class Count Board"
        >
          <div className="explore-class-count-card-left">
            <div className="explore-class-count-card-icon-orange">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <span className="explore-class-count-card-title-orange">Class Count Board</span>
          </div>
          <div className="explore-class-count-card-arrow-orange">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Section 3: Coming Soon */}
      <div className="explore-section explore-coming-soon-section">
        <span className="section-label-text">Other Features</span>
        <div className="section-label-line" />

        <div className="explore-coming-soon-card">
          <div className="coming-soon-glow-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <h3>Other interesting features will be coming soon</h3>
        </div>
      </div>
    </div>
  );
}
