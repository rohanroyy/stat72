import React, { useState, useEffect, useRef, useCallback } from 'react';
import lottie from 'lottie-web';
import { getAllUnburnedGlimpses, burnGlimpseView, reactToGlimpse, subscribeToGlimpses, cleanupExpiredGlimpses } from '../../services/glimpseService';
import loveEmoji from './emojis/love.png';
import happyEmoji from './emojis/haha.png';
import sadEmoji from './emojis/sad.png';
import wowEmoji from './emojis/wow.png';
import angryEmoji from './emojis/angry.png';

// Lottie Animation component for Empty / Finished state
function CatEmptyAnimation() {
  const containerRef = useRef(null);

  useEffect(() => {
    let anim;
    let active = true;

    fetch('/Cat playing animation.json')
      .then(res => res.json())
      .then(data => {
        if (active && containerRef.current) {
          containerRef.current.innerHTML = ''; // clear any duplicates
          anim = lottie.loadAnimation({
            container: containerRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: data,
          });
        }
      })
      .catch(err => console.error('Cat animation error:', err));

    return () => {
      active = false;
      if (anim) anim.destroy();
    };
  }, []);

  return <div ref={containerRef} className="glimpse-cat-animation-box" />;
}

export default function GlimpseViewerTray({ currentStudent }) {
  const [glimpses, setGlimpses] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Active reactions map: { [glimpseId]: reactionType }
  const [userReactions, setUserReactions] = useState({});

  // Touch / Drag Ref Physics for Front Card
  const cardRef = useRef(null);
  const isDragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const currentDelta = useRef({ x: 0, y: 0 });

  const viewerId = currentStudent?.id || 'guest_viewer';

  const loadUnburnedGlimpses = useCallback(async () => {
    try {
      const list = await getAllUnburnedGlimpses(viewerId);
      setGlimpses(list);
      setCurrentIndex(0);
    } catch (err) {
      console.error('Failed to load glimpses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [viewerId]);

  useEffect(() => {
    // Clean up expired glimpses from DB first, then load fresh list
    cleanupExpiredGlimpses().finally(() => {
      loadUnburnedGlimpses();
    });
    const unsub = subscribeToGlimpses(() => {
      loadUnburnedGlimpses();
    });
    return () => unsub();
  }, [loadUnburnedGlimpses]);

  // Current front card in the stack
  const currentGlimpse = glimpses[currentIndex];

  // Advance card & burn current front glimpse
  const advanceAndBurn = async () => {
    if (!currentGlimpse) return;
    const glimpseToBurn = currentGlimpse;

    burnGlimpseView(glimpseToBurn.id, viewerId).catch(err => {
      console.error('Failed to burn glimpse view:', err);
    });

    setCurrentIndex(prev => prev + 1);
  };

  // Drag physics setup for front card
  useEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const handleStart = (e) => {
      isDragging.current = true;
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;
      startPos.current = { x: clientX, y: clientY };
      currentDelta.current = { x: 0, y: 0 };
      cardEl.style.transition = 'none';
    };

    const handleMove = (e) => {
      if (!isDragging.current) return;
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;
      if (clientX == null || clientY == null) return;

      const dx = clientX - startPos.current.x;
      const dy = clientY - startPos.current.y;
      currentDelta.current = { x: dx, y: dy };

      const rotateDeg = Math.min(25, Math.max(-25, dx * 0.1));
      cardEl.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rotateDeg}deg)`;
    };

    const handleEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;

      const dx = currentDelta.current.x;
      const threshold = 90; // px threshold to trigger burn swipe

      if (Math.abs(dx) >= threshold) {
        // Swipe out off-screen
        const flyX = dx > 0 ? 500 : -500;
        const flyRotate = dx > 0 ? 30 : -30;
        cardEl.style.transition = 'transform 0.28s ease-out, opacity 0.28s ease-out';
        cardEl.style.transform = `translate3d(${flyX}px, 0, 0) rotate(${flyRotate}deg)`;
        cardEl.style.opacity = '0';

        setTimeout(() => {
          if (cardEl) {
            cardEl.style.transition = 'none';
            cardEl.style.transform = 'translate3d(0,0,0) rotate(0deg)';
            cardEl.style.opacity = '1';
          }
          advanceAndBurn();
        }, 280);
      } else {
        // Spring back to center
        cardEl.style.transition = 'transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        cardEl.style.transform = 'translate3d(0,0,0) rotate(0deg)';
      }
    };

    cardEl.addEventListener('mousedown', handleStart);
    cardEl.addEventListener('touchstart', handleStart, { passive: true });
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);

    return () => {
      cardEl.removeEventListener('mousedown', handleStart);
      cardEl.removeEventListener('touchstart', handleStart);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [currentIndex, currentGlimpse]);

  // Handle reaction toggle
  const handleReaction = async (reactionType) => {
    if (!currentGlimpse || !viewerId) return;

    const glimpseId = currentGlimpse.id;
    const currentReaction = userReactions[glimpseId];
    const newReaction = currentReaction === reactionType ? null : reactionType;

    setUserReactions(prev => ({ ...prev, [glimpseId]: newReaction }));

    const counts = { ...currentGlimpse.reactionCounts };
    if (currentReaction && counts[currentReaction] > 0) counts[currentReaction]--;
    if (newReaction) counts[newReaction] = (counts[newReaction] || 0) + 1;
    currentGlimpse.reactionCounts = counts;

    try {
      await reactToGlimpse(glimpseId, viewerId, reactionType);
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  const uploaderName = currentGlimpse?.uploaderStudent?.name || 'Student';
  const uploaderInitials = currentGlimpse?.uploaderStudent?.name
    ? currentGlimpse.uploaderStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'ST';

  return (
    <div className="explore-section glimpse-viewer-tray-section">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span className="section-label-text">Batch Glimpses</span>
        {glimpses.length > 0 && currentIndex < glimpses.length && (
          <span className="glimpse-badge-pill" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {currentIndex + 1} of {glimpses.length}
          </span>
        )}
      </div>
      <div className="section-label-line" style={{ marginBottom: '2px' }} />

      <div className="explore-glimpse-stack-wrapper">
        {isLoading ? (
          <div className="glimpse-tray-skeleton">
            <div className="pdf-loading-spinner" style={{ width: '20px', height: '20px', borderTopColor: 'var(--accent)' }} />
            <span>Opening Glimpses...</span>
          </div>
        ) : currentIndex >= glimpses.length ? (
          /* Empty / Finished State with Cat Playing Animation */
          <div className="glimpse-empty-cat-card">
            <CatEmptyAnimation />
            <p className="glimpse-empty-cat-text">
              No new glimpses left to view. Check back later when others snap glimpses
            </p>
          </div>
        ) : (
          /* INLINE 3D FAN STACK */
          <div className="glimpse-inline-stack-outer">
            <div className="glimpse-inline-stack-container">
              {/* Background Ghost Card 2 (backmost) */}
              {currentIndex + 2 < glimpses.length && (
                <div className="glimpse-fanned-card ghost-back" />
              )}

              {/* Background Ghost Card 1 (middle) */}
              {currentIndex + 1 < glimpses.length && (
                <div className="glimpse-fanned-card ghost-middle" />
              )}

              {/* FRONT CARD (Interactive Swipeable) — image + caption only */}
              <div ref={cardRef} className="glimpse-fanned-card front-card">
                {/* Image */}
                <img
                  src={currentGlimpse.imageUrl}
                  alt="Glimpse"
                  className="front-card-img"
                  draggable={false}
                />

                {/* Caption Overlay top-left */}
                {currentGlimpse.caption && (
                  <div className="front-card-caption-overlay bangla-caption-styled">
                    {currentGlimpse.caption}
                  </div>
                )}
              </div>

            </div>

            {/* ── Below-card: Uploader Info + Reaction Panel ── */}
            <div className="glimpse-below-card-info">
              {/* Uploader Avatar & Name */}
              <div className="front-card-uploader-info">
                {currentGlimpse.uploaderStudent?.profile_picture ? (
                  <img src={currentGlimpse.uploaderStudent.profile_picture} alt={uploaderName} className="uploader-avatar-img" />
                ) : (
                  <div className="uploader-avatar-initials">{uploaderInitials}</div>
                )}
                <span className="uploader-name-text">{uploaderName}</span>
              </div>

              {/* Single-Select Reaction Panel */}
              <div className="front-card-reaction-panel" onClick={(e) => e.stopPropagation()}>
                {[
                  { type: 'love',  img: loveEmoji },
                  { type: 'happy', img: happyEmoji },
                  { type: 'sad',   img: sadEmoji },
                  { type: 'wow',   img: wowEmoji },
                  { type: 'angry', img: angryEmoji },
                ].map((item) => {
                  const isActive = userReactions[currentGlimpse.id] === item.type;
                  const count = currentGlimpse.reactionCounts?.[item.type] || 0;

                  return (
                    <button
                      key={item.type}
                      className={`reaction-pill-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleReaction(item.type)}
                      title={item.type}
                    >
                      <img src={item.img} alt={item.type} className="reaction-emoji-img" />
                      {count > 0 && <span className="pill-count-white">{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
