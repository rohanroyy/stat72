import React, { useState, useEffect, useRef } from 'react';
import { createGlimpse, getGlimpsesForUploader, deleteGlimpse, subscribeToGlimpses } from '../../services/glimpseService';

export default function GlimpseUploaderCard({ student }) {
  // Modal toggles
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);

  // Capture & upload states
  const [capturedImage, setCapturedImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Live camera states
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraFacing, setCameraFacing] = useState('user'); // 'user' | 'environment'
  const [cameraError, setCameraError] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraInitializing, setIsCameraInitializing] = useState(false);

  // Manager & Detail view states
  const [myGlimpses, setMyGlimpses] = useState([]);
  const [selectedGlimpse, setSelectedGlimpse] = useState(null);
  const [isLoadingGlimpses, setIsLoadingGlimpses] = useState(false);

  const videoRef = useRef(null);

  // Callback ref to bind stream & play video instantly upon DOM mount
  const videoRefCallback = (el) => {
    videoRef.current = el;
    if (el && cameraStream && el.srcObject !== cameraStream) {
      el.srcObject = cameraStream;
      el.play().catch(err => console.warn('Auto play video failed:', err));
    }
  };

  // Stop camera tracks helper
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  // Start live camera stream
  const startCamera = async (facing = cameraFacing) => {
    setCameraError(null);
    setIsCameraInitializing(true);

    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setIsCameraActive(true);

      // Trigger immediate play if ref is already bound
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('Immediate video play failed:', e));
      }
    } catch (err) {
      console.error('Camera stream access failed:', err);
      setIsCameraActive(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access denied. Please grant camera permission in your site settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera device found on this device.');
      } else {
        setCameraError(err.message || 'Unable to access camera.');
      }
    } finally {
      setIsCameraInitializing(false);
    }
  };

  const handleToggleFacing = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    if (showCameraModal && !capturedImage) {
      startCamera(nextFacing);
    }
  };

  // Manage camera stream lifecycle
  useEffect(() => {
    if (showCameraModal && !capturedImage) {
      startCamera(cameraFacing);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [showCameraModal, capturedImage]);

  // Synchronize stream updates to the mounted video tag
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.warn('Video sync play failed:', e));
    }
  }, [cameraStream]);

  // Navigation: back/gesture wrappers
  const handleOpenCameraModal = () => {
    setShowCameraModal(true);
    window.history.pushState({ modal: 'glimpseCamera' }, '');
  };

  const handleCloseCameraModal = () => {
    if (window.history.state?.modal === 'glimpseCamera') {
      window.history.back();
    } else {
      stopCamera();
      setCapturedImage(null);
      setCaption('');
      setShowCaptionInput(false);
      setShowCameraModal(false);
    }
  };

  const handleOpenGallery = () => {
    setShowManagerModal(true);
    window.history.pushState({ modal: 'glimpseGallery' }, '');
  };

  const handleSelectGlimpseForDetail = (g) => {
    setSelectedGlimpse(g);
    window.history.pushState({ modal: 'glimpseDetail' }, '');
  };

  const handleGalleryBack = () => {
    if (window.history.state?.modal === 'glimpseDetail') {
      window.history.back();
    } else if (window.history.state?.modal === 'glimpseGallery') {
      window.history.back();
    } else {
      if (selectedGlimpse) setSelectedGlimpse(null);
      else setShowManagerModal(false);
    }
  };

  const handleBackdropClose = () => {
    if (window.history.state?.modal === 'glimpseDetail') {
      window.history.go(-2);
    } else if (window.history.state?.modal === 'glimpseGallery') {
      window.history.back();
    } else {
      setShowManagerModal(false);
    }
  };

  // Unified popstate listener for back gesture navigation
  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state;

      // Close Camera Modal
      if (showCameraModal && (!state || state.modal !== 'glimpseCamera')) {
        stopCamera();
        setCapturedImage(null);
        setCaption('');
        setShowCaptionInput(false);
        setShowCameraModal(false);
      }

      // Close Detail Modal (go back to Grid)
      if (selectedGlimpse && (!state || state.modal !== 'glimpseDetail')) {
        setSelectedGlimpse(null);
      }

      // Close Gallery Modal entirely
      if (showManagerModal && (!state || (state.modal !== 'glimpseGallery' && state.modal !== 'glimpseDetail'))) {
        setShowManagerModal(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showCameraModal, showManagerModal, selectedGlimpse, cameraStream]);

  // Load uploader glimpses list
  const loadMyGlimpses = async () => {
    if (!student?.id) return;
    setIsLoadingGlimpses(true);
    try {
      const data = await getGlimpsesForUploader(student.id);
      setMyGlimpses(data);
    } catch (err) {
      console.error('Failed to load glimpses:', err);
    } finally {
      setIsLoadingGlimpses(false);
    }
  };

  useEffect(() => {
    loadMyGlimpses();
    const unsub = subscribeToGlimpses(() => {
      loadMyGlimpses();
    });
    return () => unsub();
  }, [student?.id]);

  // Capture snapshot from live camera feed
  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !isCameraActive) return;

    const video = videoRef.current;
    const vWidth = video.videoWidth || 800;
    const vHeight = video.videoHeight || 800;

    const cropSize = Math.min(vWidth, vHeight);
    const sx = (vWidth - cropSize) / 2;
    const sy = (vHeight - cropSize) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');

    if (cameraFacing === 'user') {
      ctx.translate(800, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 800, 800);

    const compressedJpeg = canvas.toDataURL('image/jpeg', 0.82);

    setCapturedImage(compressedJpeg);
    setCaption('');
    setShowCaptionInput(false);
    stopCamera();
  };

  const handleDiscard = () => {
    setCapturedImage(null);
    setCaption('');
    setShowCaptionInput(false);
    startCamera(cameraFacing);
  };

  const handleUpload = async () => {
    if (!capturedImage || !student?.id || isUploading) return;
    setIsUploading(true);

    try {
      const formattedCaption = caption ? caption.trim().toUpperCase() : null;
      await createGlimpse(student.id, capturedImage, formattedCaption);
      setCapturedImage(null);
      setCaption('');
      setShowCaptionInput(false);
      setShowCameraModal(false);
      await loadMyGlimpses();
    } catch (err) {
      console.error('Failed to upload glimpse:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (glimpseId) => {
    if (!student?.id || !glimpseId) return;

    try {
      await deleteGlimpse(glimpseId, student.id);
      setSelectedGlimpse(null);
      await loadMyGlimpses();
    } catch (err) {
      console.error('Failed to delete glimpse:', err);
    }
  };

  return (
    <>
      {/* ── DASHBOARD BLACK PILL SHAPE BUTTON (Below Date/Mood Widget) ──────── */}
      <div className="dash-add-glimpse-row">
        <button
          className="dash-add-glimpse-black-pill"
          onClick={handleOpenCameraModal}
        >
          <img
            src="/glimpse logoAsset 1.png"
            alt="Glimpse"
            className="glimpse-pill-logo-icon"
          />
          <span>Add Glimpse</span>
        </button>
      </div>

      {/* ── FULL PAGE #111111 CAMERA VIEW ────────────────────────────────────── */}
      {showCameraModal && (
        <div className="glimpse-fullpage-camera-container">
          {/* Top Bar: Line Icon Back Arrow */}
          <div className="glimpse-fullpage-topbar">
            <button
              className="glimpse-line-icon-back-btn"
              onClick={handleCloseCameraModal}
              title="Back"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          </div>

          <div className="glimpse-fullpage-body">
            {!capturedImage ? (
              /* LIVE CAMERA VIEWFINDER */
              <div className="glimpse-viewfinder-frame camera-fullpage-frame">
                {isCameraActive ? (
                  <video
                    ref={videoRefCallback}
                    autoPlay
                    playsInline
                    muted
                    className="live-camera-video"
                    style={{
                      transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'none'
                    }}
                  />
                ) : isCameraInitializing ? (
                  <div className="viewfinder-inner">
                    <div className="pdf-loading-spinner" style={{ borderTopColor: 'var(--accent)', margin: '0 auto 12px' }} />
                    <p className="viewfinder-hint">Opening camera...</p>
                  </div>
                ) : (
                  <div className="viewfinder-inner">
                    <p className="viewfinder-hint" style={{ color: cameraError ? '#ef4444' : '#94a3b8' }}>
                      {cameraError || 'Camera permission required to capture Glimpse'}
                    </p>
                    <button
                      className="glimpse-grant-cam-btn"
                      onClick={() => startCamera(cameraFacing)}
                    >
                      Grant Camera Permission
                    </button>
                  </div>
                )}

                {/* Switch Camera Icon at bottom right corner of camera viewer */}
                {isCameraActive && (
                  <button
                    className="glimpse-cam-switch-corner-btn"
                    onClick={handleToggleFacing}
                    title="Switch Camera"
                  >
                    <img src="/camera switchAsset 4.png" alt="Switch Camera" className="cam-switch-asset-img" />
                  </button>
                )}
              </div>
            ) : (
              /* CAPTURED PREVIEW STATE */
              <div className="glimpse-captured-frame camera-fullpage-frame">
                <div className="preview-image-wrap">
                  <img src={capturedImage} alt="Captured Snapshot" className="captured-preview-img" />

                  {/* Caption pill button top-left */}
                  {!showCaptionInput ? (
                    <button
                      className="glimpse-caption-pill-btn"
                      onClick={() => setShowCaptionInput(true)}
                    >
                      {caption ? `"${caption}"` : '💬 Add caption'}
                    </button>
                  ) : (
                    <div className="glimpse-caption-input-overlay">
                      <input
                        type="text"
                        className="caption-input-field"
                        placeholder="Caption (max 25 chars)..."
                        maxLength={25}
                        value={caption}
                        autoFocus
                        onChange={(e) => setCaption(e.target.value.slice(0, 25))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setShowCaptionInput(false);
                        }}
                      />
                      <span className="caption-counter">{caption.length}/25</span>
                      <button
                        className="caption-done-btn"
                        onClick={() => setShowCaptionInput(false)}
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions Bar: Discard (X) and Confirm (Checkmark) */}
                <div className="glimpse-captured-actions-bar">
                  <button
                    className="glimpse-action-discard-btn"
                    onClick={handleDiscard}
                    title="Discard & Retake"
                    disabled={isUploading}
                  >
                    ✕
                  </button>

                  <button
                    className="glimpse-action-confirm-btn"
                    onClick={handleUpload}
                    title="Confirm & Share Glimpse"
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <div className="pdf-loading-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                    ) : (
                      '✓'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Below Camera Viewer Controls Row: Shutter button & Gallery Asset Icon on Right */}
            {!capturedImage && isCameraActive && (
              <div className="glimpse-fullpage-controls-row">
                <div style={{ width: '42px' }} /> {/* balancer */}

                {/* Circular Shutter Button */}
                <button
                  className="glimpse-fullpage-shutter-btn"
                  onClick={handleCaptureSnapshot}
                  title="Take Photo"
                >
                  <div className="shutter-inner-dot" />
                </button>

                {/* Gallery Asset Icon on Right */}
                <button
                  className="glimpse-gallery-icon-btn"
                  onClick={handleOpenGallery}
                  title="My Uploaded Glimpses"
                >
                  <img src="/galleryAsset 3.png" alt="Gallery" className="gallery-asset-img" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MY GLIMPSES GALLERY MODAL ────────────────────────────────────── */}
      {showManagerModal && (
        <div className="glimpse-modal-backdrop" onClick={handleBackdropClose}>
          <div className="glimpse-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="glimpse-modal-header">
              <button
                className="glimpse-modal-back-btn"
                onClick={handleGalleryBack}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <h3 className="glimpse-modal-title">
                {selectedGlimpse ? 'Glimpse Details' : 'My Uploaded Glimpses'}
              </h3>
              <div style={{ width: '24px' }} />
            </div>

            {!selectedGlimpse ? (
              /* GRID VIEW */
              <div className="glimpse-manager-body">
                {isLoadingGlimpses ? (
                  <div className="glimpse-empty-box">
                    <div className="pdf-loading-spinner" style={{ borderTopColor: 'var(--accent)' }} />
                    <p>Loading your glimpses...</p>
                  </div>
                ) : myGlimpses.length === 0 ? (
                  <div className="glimpse-empty-box dashed">
                    <p className="empty-title">No glimpses shared yet</p>
                    <p className="empty-sub">Snap a live camera photo to share!</p>
                  </div>
                ) : (
                  <div className="glimpse-grid-3col">
                    {myGlimpses.map((g) => (
                      <div
                        key={g.id}
                        className="glimpse-thumb-card"
                        onClick={() => handleSelectGlimpseForDetail(g)}
                      >
                        <img src={g.imageUrl} alt="Glimpse thumbnail" className="thumb-img" />
                        <div className="thumb-views-badge">
                          <img src="/viewAsset 2.png" alt="Views" className="view-asset-icon-sm" />
                          <span>{g.viewCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* DETAIL VIEW (Uploader's Own Glimpse) */
              <div className="glimpse-detail-body">
                <div className="glimpse-detail-image-wrap">
                  <img src={selectedGlimpse.imageUrl} alt="Glimpse Detail" className="detail-img" />
                  
                  {/* View count at bottom right corner of glimpse image */}
                  <div className="detail-views-bottom-right">
                    <img src="/viewAsset 2.png" alt="Views" className="view-asset-icon-md" />
                    <span>{selectedGlimpse.viewCount}</span>
                  </div>

                  {selectedGlimpse.caption && (
                    <div className="detail-caption-overlay bangla-caption-styled">
                      {selectedGlimpse.caption}
                    </div>
                  )}
                </div>

                {/* Reaction counts breakdown (Count text in WHITE #ffffff) */}
                <div className="glimpse-reactions-breakdown-row">
                  <div className="reaction-stat-item">
                    <span className="stat-emoji">❤️</span>
                    <span className="stat-num-white">{selectedGlimpse.reactionCounts?.love || 0}</span>
                  </div>
                  <div className="reaction-stat-item">
                    <span className="stat-emoji">😄</span>
                    <span className="stat-num-white">{selectedGlimpse.reactionCounts?.happy || 0}</span>
                  </div>
                  <div className="reaction-stat-item">
                    <span className="stat-emoji">😢</span>
                    <span className="stat-num-white">{selectedGlimpse.reactionCounts?.sad || 0}</span>
                  </div>
                  <div className="reaction-stat-item">
                    <span className="stat-emoji">😡</span>
                    <span className="stat-num-white">{selectedGlimpse.reactionCounts?.angry || 0}</span>
                  </div>
                </div>

                {/* Delete button with deleteAsset 5.png icon */}
                <button
                  className="glimpse-danger-delete-btn"
                  onClick={() => handleDelete(selectedGlimpse.id)}
                >
                  <img src="/deleteAsset 5.png" alt="Delete" className="delete-asset-icon" />
                  <span>Delete Glimpse</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
