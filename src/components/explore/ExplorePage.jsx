import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function ExplorePage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bubbleStyles, setBubbleStyles] = useState([]);

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
        const speed = 12 + (idx * 4) % 12; // 12s to 24s
        const delay = -((idx * 3) % 15); // negative delay
        const animIdx = (idx % 3) + 1; // drift-1, drift-2, drift-3
        
        // Generate random floating direction offsets each time
        const dx1 = Math.floor(Math.random() * 60) - 30; // -30px to +30px
        const dy1 = Math.floor(Math.random() * 60) - 30;
        const dx2 = Math.floor(Math.random() * 60) - 30;
        const dy2 = Math.floor(Math.random() * 60) - 30;

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
                  <div
                    key={student.id || idx}
                    className="mood-bubble-wrapper"
                    style={{
                      left: style.left,
                      top: style.top,
                      animationName: style.animationName,
                      animationDuration: style.animationDuration,
                      animationDelay: style.animationDelay,
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
                        <img src={student.profile_picture} alt={student.name} />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className="mood-bubble-tooltip">{student.name}</div>
                  </div>
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

      {/* Section 2: Coming Soon */}
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
