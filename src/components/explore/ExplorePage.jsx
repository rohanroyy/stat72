import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import ImposterGame from './ImposterGame';

// Sub-component for individual draggable floating mood bubble with 60FPS direct DOM drag handling
function FloatingMoodBubble({ student, style, initials }) {
  const bubbleRef = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, startX: 0, startY: 0 });
  const currentPos = useRef({ x: 0, y: 0 });

  const handleStart = (e) => {
    // Only primary mouse button or touch
    if (e.button !== undefined && e.button !== 0) return;

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    if (clientX === undefined || clientY === undefined) return;

    setIsDragging(true);
    dragStart.current = {
      mouseX: clientX,
      mouseY: clientY,
      startX: currentPos.current.x,
      startY: currentPos.current.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const el = bubbleRef.current;
    if (el) {
      el.style.transition = 'none';
      el.style.animation = 'none';
    }

    const handleMove = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      if (clientX === undefined || clientY === undefined) return;

      const dx = clientX - dragStart.current.mouseX;
      const dy = clientY - dragStart.current.mouseY;

      const newX = dragStart.current.startX + dx;
      const newY = dragStart.current.startY + dy;

      currentPos.current = { x: newX, y: newY };

      if (el) {
        el.style.transform = `translate3d(${newX}px, ${newY}px, 0)`;
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      setPos(currentPos.current);
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
  }, [isDragging]);

  return (
    <div
      ref={bubbleRef}
      className={`mood-bubble-wrapper ${isDragging ? 'is-dragging' : ''}`}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
      style={{
        left: style.left,
        top: style.top,
        animationName: isDragging ? 'none' : style.animationName,
        animationDuration: style.animationDuration,
        animationDelay: style.animationDelay,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: isDragging ? 999 : undefined,
        transition: isDragging ? 'none' : undefined,
        '--dx1': style['--dx1'],
        '--dy1': style['--dy1'],
        '--dx2': style['--dx2'],
        '--dy2': style['--dy2']
      }}
    >
      {/* Speech bubble at the top */}
      <div className="mood-bubble-content">
        <span className="mood-emoji-text">{student.mood}</span>
      </div>

      {/* Profile avatar at the bottom */}
      <div className="mood-bubble-avatar">
        {student.profile_picture ? (
          <img src={student.profile_picture} alt={student.name} draggable={false} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="mood-bubble-tooltip">{student.name}</div>
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
        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from('students')
            .select('id, name, mood, profile_picture')
            .not('mood', 'is', null);
          if (error) throw error;
          setStudents(data || []);
        } else {
          const rawMock = localStorage.getItem('bahattor_mock_students') || '[]';
          const mockStudents = JSON.parse(rawMock);
          const activeMoods = mockStudents.filter(s => s.mood);
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
        // Distribute starting positions nicely
        const left = 5 + (idx * 37) % 70; // 5% to 75%
        const top = 10 + (idx * 29) % 60; // 10% to 70%
        const speed = 14 + (idx * 4) % 12; // 14s to 26s slow smooth speed
        const delay = -((idx * 3) % 15); // negative delay
        const animIdx = (idx % 3) + 1; // drift-1, drift-2, drift-3
        
        // Reduced floating direction offsets (-10px to +10px for subtle movement)
        const dx1 = Math.floor(Math.random() * 20) - 10;
        const dy1 = Math.floor(Math.random() * 20) - 10;
        const dx2 = Math.floor(Math.random() * 20) - 10;
        const dy2 = Math.floor(Math.random() * 20) - 10;

        return {
          left: `${left}%`,
          top: `${top}%`,
          animationName: `float-drift-${animIdx}`,
          animationDuration: `${speed}s`,
          animationDelay: `${delay}s`,
          '--dx1': `${dx1}px`,
          '--dy1': `${dy1}px`,
          '--dx2': `${dx2}px`,
          '--dy2': `${dy2}px`
        };
      });
      setBubbleStyles(styles);
    }
  }, [students]);

  // Dynamically change height of the section as mood numbers increase (starts small)
  const boardHeight = students.length === 0 ? 180 : Math.max(180, Math.min(800, 150 + students.length * 50));

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
                const style = bubbleStyles[idx] || {};

                return (
                  <FloatingMoodBubble
                    key={student.id || idx}
                    student={student}
                    style={style}
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
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
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
