import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import ImposterGame from './ImposterGame';

/**
 * FloatingMoodBubble — two-layer architecture:
 *
 *  <div class="mood-float-track">   ← outer: handles CSS keyframe float animation
 *    <div class="mood-drag-layer">  ← inner: handles drag offset via direct DOM translate3d
 *      ... bubble content ...
 *    </div>
 *  </div>
 *
 * Keeping animation and drag on SEPARATE elements means they never
 * fight over the `transform` property, so animations keep running
 * even after a bubble is dragged to a new position.
 */
function FloatingMoodBubble({ student, style, initials }) {
  const dragLayerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0 });
  const accOffset = useRef({ x: 0, y: 0 }); // accumulated offset that persists across drags

  // Register global listeners once — use refs inside to avoid stale closures
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

      // Update DOM directly — zero React re-render overhead → 60fps
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

      // Restore cursor & restore float-track animation (just remove class flag from drag layer)
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
  }, []); // ← empty deps: register once, use refs inside

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
    // OUTER: float animation lives here — never gets an inline transform from drag
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
      {/* INNER: drag offset lives here — has no animation, no conflict */}
      <div
        ref={dragLayerRef}
        className="mood-bubble-wrapper"
        onMouseDown={handleStart}
        onTouchStart={handleStart}
        style={{
          /* initial transform — 0,0 so translate3d doesn't conflict with parent animation */
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

export default function ExplorePage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bubbleStyles, setBubbleStyles] = useState([]);
  const [showImposterGame, setShowImposterGame] = useState(false);

  useEffect(() => {
    async function loadMoods() {
      try {
        const now = Date.now();
        const twelveHours = 12 * 60 * 60 * 1000;

        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from('students')
            .select('id, name, mood, profile_picture, mood_selected_at')
            .not('mood', 'is', null);
          if (error) throw error;
          
          const activeMoods = (data || []).filter(s => {
            if (!s.mood_selected_at) return false;
            return (now - new Date(s.mood_selected_at).getTime()) < twelveHours;
          });
          setStudents(activeMoods);
        } else {
          const rawMock = localStorage.getItem('bahattor_mock_students') || '[]';
          const mockStudents = JSON.parse(rawMock);
          const activeMoods = mockStudents.filter(s => {
            if (!s.mood) return false;
            if (!s.mood_selected_at) return false;
            return (now - new Date(s.mood_selected_at).getTime()) < twelveHours;
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

  useEffect(() => {
    if (students.length > 0) {
      const styles = students.map((s, idx) => {
        const left = 5 + (idx * 37) % 70;
        const top  = 10 + (idx * 29) % 60;
        const speed = 14 + (idx * 4) % 12;
        const delay = -((idx * 3) % 15);
        const animIdx = (idx % 3) + 1;

        // Subtle drift — ±10px
        const dx1 = Math.floor(Math.random() * 20) - 10;
        const dy1 = Math.floor(Math.random() * 20) - 10;
        const dx2 = Math.floor(Math.random() * 20) - 10;
        const dy2 = Math.floor(Math.random() * 20) - 10;

        return {
          left: `${left}%`,
          top:  `${top}%`,
          animationName: `float-drift-${animIdx}`,
          animationDuration: `${speed}s`,
          animationDelay: `${delay}s`,
          '--dx1': `${dx1}px`,
          '--dy1': `${dy1}px`,
          '--dx2': `${dx2}px`,
          '--dy2': `${dy2}px`,
        };
      });
      setBubbleStyles(styles);
    }
  }, [students]);

  const boardHeight = students.length === 0
    ? 180
    : Math.max(180, Math.min(800, 150 + students.length * 50));

  if (showImposterGame) {
    return <ImposterGame onClose={() => setShowImposterGame(false)} />;
  }

  return (
    <div className="explore-container">
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

      {/* Section 2: Guess the Imposter Mini Game */}
      <div className="explore-section">
        <span className="section-label-text">Guess the Imposter</span>
        <div className="section-label-line" />

        <div className="explore-game-card" onClick={() => setShowImposterGame(true)}>
          <div className="game-card-icon">🕵️‍♂️</div>
          <div className="game-card-details">
            <h3>Play Guess the Imposter</h3>
            <p>Deceive your friends or spot the odd drawing in this quick party game!</p>
          </div>
          <div className="game-card-action">
            <span>Play</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>
      </div>

      {/* Section 3: Coming Soon */}
      <div className="explore-section explore-coming-soon-section">
        <span className="section-label-text">Feature Roadmap</span>
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
