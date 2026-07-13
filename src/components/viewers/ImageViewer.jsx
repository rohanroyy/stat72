import React, { useState, useRef, useCallback, useEffect } from 'react';
import { IconZoomIn, IconZoomOut } from '../common/Icons';
import { getViewUrl } from '../../services/driveService';

/**
 * Image Viewer with zoom (wheel + buttons) and pan (drag).
 */
export default function ImageViewer({ file }) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef(null);

  const imageUrl = file.url || getViewUrl(file.id, file.mimeType);

  // Reset when file changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setLoaded(false);
    setError(false);
  }, [file.id]);

  // Wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale((s) => Math.min(5, Math.max(0.25, s + delta)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Drag pan
  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch support
  const handleTouchStart = (e) => {
    if (scale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => setIsDragging(false);

  // Double click to reset
  const handleDoubleClick = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const zoomIn = () => setScale((s) => Math.min(5, s + 0.25));
  const zoomOut = () => {
    setScale((s) => {
      const newScale = Math.max(0.25, s - 0.25);
      if (newScale <= 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };

  return (
    <div
      className="image-viewer"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
    >
      {!loaded && !error && (
        <div className="pdf-loading">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="pdf-loading-spinner" style={{ borderTopColor: 'var(--gold-600)' }} />
            <span>Loading image…</span>
          </div>
        </div>
      )}

      {error && (
        <div className="pdf-loading" style={{ color: 'var(--fuchsia-600)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <span>Unable to load image</span>
            <a
              href={file.url || `https://drive.google.com/file/d/${file.id}/view`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 20px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-hairline)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              {file.url ? 'Open / Download Image' : 'Open in Google Drive'}
            </a>
          </div>
        </div>
      )}

      <img
        src={imageUrl}
        alt={file.name}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          display: loaded ? 'block' : 'none',
          transition: isDragging ? 'none' : 'transform 200ms ease-out',
        }}
      />

      {loaded && (
        <div className="image-controls">
          <button className="pdf-zoom-btn" onClick={zoomOut} aria-label="Zoom out">
            <IconZoomOut size={16} />
          </button>
          <span className="image-zoom-info">{Math.round(scale * 100)}%</span>
          <button className="pdf-zoom-btn" onClick={zoomIn} aria-label="Zoom in">
            <IconZoomIn size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
