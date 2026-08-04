import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconChevronLeft, IconChevronRight, IconZoomIn, IconZoomOut } from '../common/Icons';
import { getViewUrl } from '../../services/driveService';
import { getOrFetchCachedFile } from '../../services/fileCacheService';

/**
 * Individual PDF Page renderer component
 * Uses IntersectionObserver to lazy-render canvas only when close to viewport.
 */
function PDFPage({ pdfDoc, pageNum, scale }) {
  const [viewport, setViewport] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Load viewport metadata at scale 1.0 to set aspect ratio
  useEffect(() => {
    let active = true;
    pdfDoc.getPage(pageNum).then((page) => {
      if (active) {
        setViewport(page.getViewport({ scale: 1.0 }));
      }
    }).catch((err) => {
      console.error(`[PDFPage] Error loading page ${pageNum} viewport:`, err);
    });
    return () => { active = false; };
  }, [pdfDoc, pageNum]);

  // Set up IntersectionObserver
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        rootMargin: '100% 0px 100% 0px', // Pre-render 1 viewport height ahead/behind
        threshold: 0.01,
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Render canvas content when visible
  useEffect(() => {
    let active = true;

    // Cancel any ongoing render task
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {}
    }

    async function draw() {
      if (!isVisible || !viewport || !canvasRef.current) return;

      try {
        const page = await pdfDoc.getPage(pageNum);
        if (!active || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        // Viewport scale
        const vp = page.getViewport({ scale });

        // Set buffer dimensions scaled by device pixel ratio for sharp rendering
        canvas.width = vp.width * dpr;
        canvas.height = vp.height * dpr;

        // Reset scale and apply dpr scale
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.scale(dpr, dpr);

        const renderContext = {
          canvasContext: context,
          viewport: vp,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`[PDFPage] Render error on page ${pageNum}:`, err);
        }
      }
    }

    draw();

    return () => {
      active = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [pdfDoc, pageNum, isVisible, viewport, scale]);

  const containerStyle = {
    width: viewport ? `${viewport.width * scale}px` : '100%',
    aspectRatio: viewport ? `${viewport.width} / ${viewport.height}` : '1 / 1.414',
  };

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNum}`}
      className="pdf-page-container"
      style={containerStyle}
      data-page-number={pageNum}
    >
      {isVisible && viewport ? (
        <canvas ref={canvasRef} />
      ) : (
        <div className="pdf-page-placeholder">
          Loading Page {pageNum}…
        </div>
      )}
    </div>
  );
}

/**
 * Scrollable PDF Viewer using PDF.js
 * Optimizes rendering for mobile devices by lazy-loading canvases.
 */
export default function PDFViewer({ file }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  const canvasContainerRef = useRef(null);
  const isScrollingRef = useRef(false);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      setUseIframeFallback(false);

      try {
        // PDF.js is loaded as ES module via CDN
        const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');

        // Set worker
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

        let url = await getOrFetchCachedFile(file);
        if (!url) {
          console.warn('[PDFViewer] Cache load failed, using direct Drive URL');
          url = file.url || getViewUrl(file.id, file.mimeType);
        }

        const loadingTask = pdfjsLib.getDocument({
          url,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/cmaps/',
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;

        if (cancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.warn('PDF.js fetch/CORS blocked, falling back to Google Drive iframe preview:', err);
        setUseIframeFallback(true);
        setLoading(false);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [file.id, file.mimeType]);

  // Auto-calculate scale to fit container width on load
  useEffect(() => {
    if (!pdfDoc || !canvasContainerRef.current) return;
    let active = true;

    async function determineFitScale() {
      try {
        const page = await pdfDoc.getPage(1);
        if (!active) return;
        const viewport = page.getViewport({ scale: 1.0 });
        const container = canvasContainerRef.current;
        
        // available space = container width minus padding (16px * 2 = 32px)
        const availableWidth = container.clientWidth - 32;
        let fitScale = availableWidth / viewport.width;

        // Limit fit scale and round it to 2 decimals
        fitScale = Math.round(Math.min(2.0, Math.max(0.25, fitScale)) * 100) / 100;
        setScale(fitScale);
      } catch (err) {
        console.warn('[PDFViewer] Could not calculate fit scale:', err);
      }
    }

    // Wait a brief tick for the DOM/container styles to settle
    const timer = setTimeout(determineFitScale, 50);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [pdfDoc]);

  // Handle manual scroll to track active page
  const handleScroll = useCallback(() => {
    if (isScrollingRef.current) return;
    const container = canvasContainerRef.current;
    if (!container || totalPages === 0) return;

    const children = container.querySelectorAll('.pdf-page-container');
    let closestPage = currentPage;
    let minDistance = Infinity;
    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;

    children.forEach((child) => {
      const pageNumAttr = child.getAttribute('data-page-number');
      if (!pageNumAttr) return;
      
      const rect = child.getBoundingClientRect();
      const childCenter = rect.top + rect.height / 2;
      const distance = Math.abs(childCenter - containerCenter);

      if (distance < minDistance) {
        minDistance = distance;
        closestPage = parseInt(pageNumAttr, 10);
      }
    });

    if (closestPage !== currentPage) {
      setCurrentPage(closestPage);
    }
  }, [currentPage, totalPages]);

  // Scroll listener registration
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || useIframeFallback || totalPages === 0) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll, useIframeFallback, totalPages]);

  // Navigation to specific page (triggered by buttons/keys)
  const goToPage = useCallback((pageNum) => {
    if (pageNum < 1 || pageNum > totalPages) return;
    
    const pageEl = document.getElementById(`pdf-page-${pageNum}`);
    if (pageEl && canvasContainerRef.current) {
      isScrollingRef.current = true;
      setCurrentPage(pageNum);
      
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Reset scroll tracking lock after animation ends
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 800);
    }
  }, [totalPages]);

  // Keyboard navigation
  useEffect(() => {
    if (useIframeFallback || totalPages === 0) return;
    
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPage(Math.max(1, currentPage - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goToPage(Math.min(totalPages, currentPage + 1));
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [currentPage, totalPages, useIframeFallback, goToPage]);

  const zoomIn = () => setScale((s) => Math.min(3, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.25, s - 0.25));

  if (loading) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-loading">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="pdf-loading-spinner" />
            <span>Loading PDF…</span>
          </div>
        </div>
      </div>
    );
  }

  if (useIframeFallback) {
    if (file.url) {
      const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}&embedded=true`;
      return (
        <div className="video-viewer" style={{ width: '100%', height: '100%', background: '#fff' }}>
          <iframe
            src={googleDocsViewerUrl}
            title={file.name}
            style={{ border: 'none', width: '100%', height: '100%' }}
          />
        </div>
      );
    }
    const embedUrl = `https://drive.google.com/file/d/${file.id}/preview`;
    return (
      <div className="video-viewer" style={{ width: '100%', height: '100%' }}>
        <iframe
          src={embedUrl}
          title={file.name}
          allow="autoplay"
          allowFullScreen
          style={{ border: 'none', width: '100%', height: '100%' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-loading" style={{ color: 'var(--fuchsia-600)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', maxWidth: '320px', textAlign: 'center' }}>
            <span>{error}</span>
            <a
              href={file.url || `https://drive.google.com/file/d/${file.id}/view`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginTop: '8px',
                padding: '8px 20px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-hairline)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              {file.url ? 'Open / Download PDF' : 'Open in Google Drive'}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div ref={canvasContainerRef} className="pdf-canvas-container">
        {Array.from({ length: totalPages }, (_, i) => (
          <PDFPage
            key={i + 1}
            pageNum={i + 1}
            pdfDoc={pdfDoc}
            scale={scale}
          />
        ))}
      </div>
      
      <div className="pdf-controls">
        <button
          className="pdf-page-btn"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <IconChevronLeft size={16} />
        </button>

        <span className="pdf-page-info">
          Pg {currentPage} / {totalPages}
        </span>

        <button
          className="pdf-page-btn"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <IconChevronRight size={16} />
        </button>

        <div className="pdf-zoom-controls">
          <button className="pdf-zoom-btn" onClick={zoomOut} aria-label="Zoom out">
            <IconZoomOut size={16} />
          </button>
          <span className="pdf-zoom-level">{Math.round(scale * 100)}%</span>
          <button className="pdf-zoom-btn" onClick={zoomIn} aria-label="Zoom in">
            <IconZoomIn size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
