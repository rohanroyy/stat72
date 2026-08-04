import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconChevronLeft, IconChevronRight, IconZoomIn, IconZoomOut } from '../common/Icons';
import { getViewUrl } from '../../services/driveService';
import { getOrFetchCachedFile } from '../../services/fileCacheService';

/**
 * PDF Viewer using PDF.js (loaded via CDN in index.html)
 * Renders PDF pages to canvas, with page navigation and zoom.
 */
export default function PDFViewer({ file }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

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

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || useIframeFallback) return;

    try {
      // Cancel any existing render
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
      }

      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Handle high-DPI displays
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.scale(dpr, dpr);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    }
  }, [pdfDoc, currentPage, scale, useIframeFallback]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Keyboard navigation
  useEffect(() => {
    if (useIframeFallback) return;
    const handleKey = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentPage((p) => Math.min(totalPages, p + 1));
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [totalPages, useIframeFallback]);

  const zoomIn = () => setScale((s) => Math.min(3, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.25));

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
      // Use Google Docs viewer as an iframe embed fallback for external URLs with CORS restrictions
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
      <div className="pdf-canvas-container">
        <canvas ref={canvasRef} />
      </div>
      <div className="pdf-controls">
        <button
          className="pdf-page-btn"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
