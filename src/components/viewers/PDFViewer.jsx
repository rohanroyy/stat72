import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconChevronLeft, IconChevronRight, IconZoomIn, IconZoomOut } from '../common/Icons';
import { getViewUrl } from '../../services/driveService';
import { getOrFetchCachedFile } from '../../services/fileCacheService';

// ---------- PDFPage sub-component ----------

/**
 * Renders a single PDF page onto a <canvas>.
 * - Uses IntersectionObserver on the SCROLL CONTAINER (root prop) to lazy-render.
 * - Caches the resolved PDF page object so getPage() is only called once.
 * - Renders immediately when visible, cancels when not.
 */
function PDFPage({ pdfDoc, pageNum, scale, scrollRoot }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pageObjRef = useRef(null);   // cached PDF page object
  const viewportRef = useRef(null);  // cached natural viewport (scale=1)

  const [naturalSize, setNaturalSize] = useState(null); // { w, h } at scale=1
  const [rendered, setRendered] = useState(false);
  const isVisibleRef = useRef(false);

  // Step 1: Resolve the page object once and store natural dimensions
  useEffect(() => {
    let active = true;
    async function loadMeta() {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (!active) return;
        pageObjRef.current = page;
        const vp = page.getViewport({ scale: 1.0 });
        viewportRef.current = vp;
        setNaturalSize({ w: vp.width, h: vp.height });
      } catch (err) {
        console.error(`[PDFPage] Meta error p${pageNum}:`, err);
      }
    }
    loadMeta();
    return () => { active = false; };
  }, [pdfDoc, pageNum]);

  // Step 2: Draw to canvas whenever visible + naturalSize + scale change
  const renderCanvas = useCallback(async () => {
    if (!isVisibleRef.current || !pageObjRef.current || !canvasRef.current) return;

    // Cancel any in-flight render
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
      renderTaskRef.current = null;
    }

    try {
      const page = pageObjRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const vp = page.getViewport({ scale });

      canvas.width  = Math.round(vp.width  * dpr);
      canvas.height = Math.round(vp.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const task = page.render({ canvasContext: ctx, viewport: vp });
      renderTaskRef.current = task;
      await task.promise;
      setRendered(true);
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') {
        console.error(`[PDFPage] Render error p${pageNum}:`, err);
      }
    }
  }, [pageNum, scale]);

  // Step 3: Observe visibility against the scroll container (root)
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          renderCanvas();
        } else {
          // Cancel render if scrolled away
          if (renderTaskRef.current) {
            try { renderTaskRef.current.cancel(); } catch {}
            renderTaskRef.current = null;
          }
        }
      },
      {
        root: scrollRoot,        // ← KEY FIX: observe within our scroll container
        rootMargin: '150% 0px', // pre-render 1.5 viewports above/below
        threshold: 0.01,
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [scrollRoot, renderCanvas]);

  // Re-render when scale changes and page is visible
  useEffect(() => {
    if (isVisibleRef.current && naturalSize) {
      renderCanvas();
    }
  }, [scale, naturalSize, renderCanvas]);

  // Container sized by natural aspect ratio; width capped at max usable width
  const style = naturalSize
    ? {
        aspectRatio: `${naturalSize.w} / ${naturalSize.h}`,
        // Use min of the scaled pixel size or 100% of container
        width: `min(${naturalSize.w * scale}px, 100%)`,
      }
    : { width: '100%', aspectRatio: '210 / 297' }; // A4 placeholder ratio

  return (
    <div
      ref={containerRef}
      id={`pdf-page-${pageNum}`}
      className="pdf-page-container"
      style={style}
      data-page-number={pageNum}
    >
      {naturalSize ? (
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      ) : (
        <div className="pdf-page-placeholder">Page {pageNum}</div>
      )}
    </div>
  );
}

// ---------- Main PDFViewer ----------

/**
 * Scrollable multi-page PDF Viewer using PDF.js.
 * - Streams the PDF via Cache Storage (fetch + cache on first open).
 * - Lazy-renders pages via IntersectionObserver on the real scroll container.
 * - Auto-fits page width to container on load; supports zoom & keyboard nav.
 */
export default function PDFViewer({ file }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [loadStatus, setLoadStatus] = useState('Preparing PDF…');
  const [error, setError] = useState(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  const containerRef = useRef(null); // the scroll container
  const programmingScrollRef = useRef(false);

  // ── Load PDF ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      setUseIframeFallback(false);
      setLoadStatus('Loading PDF.js…');

      try {
        const pdfjsLib = await import(
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs'
        );
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

        if (cancelled) return;
        setLoadStatus('Almost ready…');

        // Try cache first; fall back to network
        let url = await getOrFetchCachedFile(file);
        if (!url) {
          console.warn('[PDFViewer] Cache miss — using direct Drive URL');
          url = file.url || getViewUrl(file.id, file.mimeType);
        }

        if (cancelled) return;
        setLoadStatus('Parsing PDF structure…');

        const loadingTask = pdfjsLib.getDocument({
          url,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/cmaps/',
          cMapPacked: true,
          // Use range requests if supported for faster first-page display
          rangeChunkSize: 65536,
          disableAutoFetch: false,
          disableStream: false,
        });

        // Show page-count progress during streaming
        loadingTask.onProgress = ({ loaded, total }) => {
          if (!cancelled && total > 0) {
            const pct = Math.round((loaded / total) * 100);
            setLoadStatus(`Downloading… ${pct}%`);
          }
        };

        const doc = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.warn('[PDFViewer] PDF.js failed, falling back to iframe:', err);
        setUseIframeFallback(true);
        setLoading(false);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [file.id, file.mimeType]);

  // ── Auto-fit width scale ───────────────────────────────────────────────
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;
    let active = true;

    async function calcFit() {
      try {
        const page = await pdfDoc.getPage(1);
        if (!active) return;
        const vp = page.getViewport({ scale: 1.0 });
        const available = containerRef.current.clientWidth - 32; // 16px padding each side
        const fit = Math.round(Math.min(2.0, Math.max(0.25, available / vp.width)) * 100) / 100;
        setScale(fit);
      } catch {}
    }

    // Small delay lets the container finish layout
    const t = setTimeout(calcFit, 50);
    return () => { active = false; clearTimeout(t); };
  }, [pdfDoc]);

  // ── Scroll tracking → update currentPage indicator ────────────────────
  const handleScroll = useCallback(() => {
    if (programmingScrollRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const pages = container.querySelectorAll('.pdf-page-container');
    if (!pages.length) return;

    const centerY = container.scrollTop + container.clientHeight / 2;
    let best = 1, bestDist = Infinity;
    pages.forEach((el) => {
      const mid = el.offsetTop + el.offsetHeight / 2;
      const d = Math.abs(mid - centerY);
      if (d < bestDist) { bestDist = d; best = parseInt(el.dataset.pageNumber, 10); }
    });
    setCurrentPage(best);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || useIframeFallback || totalPages === 0) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll, useIframeFallback, totalPages]);

  // ── Page navigation ────────────────────────────────────────────────────
  const goToPage = useCallback((num) => {
    const container = containerRef.current;
    if (!container || num < 1 || num > totalPages) return;
    const el = document.getElementById(`pdf-page-${num}`);
    if (!el) return;
    programmingScrollRef.current = true;
    setCurrentPage(num);
    container.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' });
    setTimeout(() => { programmingScrollRef.current = false; }, 900);
  }, [totalPages]);

  // ── Keyboard navigation ────────────────────────────────────────────────
  useEffect(() => {
    if (useIframeFallback || totalPages === 0) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   { e.preventDefault(); goToPage(currentPage - 1); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  { e.preventDefault(); goToPage(currentPage + 1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [currentPage, totalPages, useIframeFallback, goToPage]);

  const zoomIn  = () => setScale((s) => Math.min(3.0, +(s + 0.25).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(0.25, +(s - 0.25).toFixed(2)));

  // ── Render states ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="pdf-viewer">
        <div className="pdf-loading">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div className="pdf-loading-spinner" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{loadStatus}</span>
          </div>
        </div>
      </div>
    );
  }

  if (useIframeFallback) {
    if (file.url) {
      const gdocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(file.url)}&embedded=true`;
      return (
        <div className="video-viewer" style={{ width: '100%', height: '100%', background: '#fff' }}>
          <iframe src={gdocsUrl} title={file.name} style={{ border: 'none', width: '100%', height: '100%' }} />
        </div>
      );
    }
    return (
      <div className="video-viewer" style={{ width: '100%', height: '100%' }}>
        <iframe
          src={`https://drive.google.com/file/d/${file.id}/preview`}
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
              target="_blank" rel="noopener noreferrer"
              style={{ marginTop: '8px', padding: '8px 20px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-2)', border: '1px solid var(--border-hairline)', color: 'var(--text-primary)', fontSize: '13px', textDecoration: 'none' }}
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
      {/* Scrollable page list */}
      <div ref={containerRef} className="pdf-canvas-container">
        {Array.from({ length: totalPages }, (_, i) => (
          <PDFPage
            key={i + 1}
            pageNum={i + 1}
            pdfDoc={pdfDoc}
            scale={scale}
            scrollRoot={containerRef.current}
          />
        ))}
      </div>

      {/* Controls bar */}
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
