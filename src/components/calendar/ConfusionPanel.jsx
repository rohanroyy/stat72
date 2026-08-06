import React, { useState, useEffect, useCallback, useRef } from 'react';
import ConfusionComposer from './ConfusionComposer';
import {
  fetchPosts, createPost, updatePost, deletePost,
  fetchReplies, createReply, deleteReply,
  deleteConfusionImages, subscribeToConfusions,
  formatRelativeTime,
} from '../../services/confusionService';

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ src, name, size = 32 }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const fallbackSrc = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || '?')}&backgroundColor=e8e8e8&textColor=333333`;

  return (
    <div
      className="cf-avatar"
      style={{ width: size, height: size, minWidth: size }}
      aria-hidden="true"
    >
      <img
        src={(!imgError && src) ? src : fallbackSrc}
        alt=""
        onError={() => setImgError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}

// ── Image Grid (Clickable → opens in app's built-in image viewer) ─────────────
function ImageGrid({ images, onOpenFile }) {
  if (!Array.isArray(images) || images.length === 0) return null;

  const handleImageClick = (img, e) => {
    e.stopPropagation();
    if (!img?.driveId && !img?.url) return;

    const fileObj = {
      id: img.driveId,
      name: img.name || 'Attached Image',
      mimeType: img.mimeType || 'image/jpeg',
      fileType: 'image',
      url: img.url || (img.driveId ? `https://drive.google.com/thumbnail?id=${img.driveId}&sz=w1000` : ''),
    };

    if (onOpenFile) {
      onOpenFile(fileObj);
    } else if (fileObj.url) {
      window.open(fileObj.url, '_blank');
    } else {
      window.open(`https://drive.google.com/file/d/${img.driveId}/view`, '_blank');
    }
  };

  const getImgSrc = (img) => {
    if (img.url) return img.url;
    if (img.driveId) {
      return `https://drive.google.com/thumbnail?id=${img.driveId}&sz=w800`;
    }
    return '';
  };

  const handleImgError = (e, img) => {
    if (img.driveId && !e.target.dataset.triedFallback) {
      e.target.dataset.triedFallback = 'true';
      e.target.src = `https://drive.google.com/uc?export=view&id=${img.driveId}`;
    }
  };

  const count = Math.min(images.length, 4);

  return (
    <div className={`cf-image-grid cf-image-grid--${count}`}>
      {images.map((img, i) => (
        <div
          key={i}
          className="cf-image-item"
          onClick={(e) => handleImageClick(img, e)}
          title={img.name || 'Click to view image'}
        >
          <img
            src={getImgSrc(img)}
            alt={img.name || 'Attached doubt image'}
            onError={(e) => handleImgError(e, img)}
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

// ── Post card (in the feed list) ───────────────────────────────────────────────
function PostCard({ post, currentUserId, currentUser, tab, examId, onOpen, onEdit, onDelete, onOpenFile }) {
  const [copied, setCopied] = useState(false);
  const isOwner = currentUserId && post.author_id === currentUserId;
  const avatarSrc = post.author_avatar || (isOwner ? currentUser?.profile_picture : null);

  const handleCopyLink = (e) => {
    e.stopPropagation();
    const url = new URL(window.location.origin);
    url.searchParams.set('e', examId);
    url.searchParams.set('c', post.id);
    navigator.clipboard.writeText(url.toString())
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
      .catch(() => {});
  };

  return (
    <div className="cf-post-card">
      {/* Author row */}
      <div className="cf-post-header">
        <Avatar src={avatarSrc} name={post.author_name} />
        <div className="cf-post-author-info">
          <span className="cf-post-author-name">{post.author_name}</span>
          <span className="cf-post-time">{formatRelativeTime(post.created_at)}</span>
        </div>
        {/* Corner actions */}
        <div className="cf-post-corner-actions">
          {/* Copy link */}
          <button
            className={`cf-icon-btn${copied ? ' cf-icon-btn--copied' : ''}`}
            onClick={handleCopyLink}
            title={copied ? 'Link copied!' : 'Copy link'}
            aria-label="Copy link to this post"
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
          </button>
          {/* Edit / Delete — only in My Doubts tab for owner */}
          {isOwner && tab === 'mine' && (
            <>
              <button className="cf-icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(post); }} title="Edit" aria-label="Edit post">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button className="cf-icon-btn cf-icon-btn--danger" onClick={(e) => { e.stopPropagation(); onDelete(post); }} title="Delete" aria-label="Delete post">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Clickable body → opens detail */}
      <button className="cf-post-body-btn" onClick={() => onOpen(post)}>
        {post.text && <p className="cf-post-text">{post.text}</p>}
        <ImageGrid images={post.images} onOpenFile={onOpenFile} />
        {/* Stats */}
        <div className="cf-post-stats">
          <span className="cf-stat-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {post.reply_count ?? 0} {(post.reply_count ?? 0) === 1 ? 'reply' : 'replies'}
          </span>
          <span className="cf-stat-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            {post.helpful ?? 0}
          </span>
          {post.status === 'solved' && (
            <span className="cf-solved-badge">Solved</span>
          )}
        </div>
      </button>
    </div>
  );
}

// ── Reply card ─────────────────────────────────────────────────────────────────
function ReplyCard({ reply, currentUserId, currentUser, onDelete, onOpenFile }) {
  const isOwner = currentUserId && reply.author_id === currentUserId;
  const avatarSrc = reply.author_avatar || (isOwner ? currentUser?.profile_picture : null);
  return (
    <div className="cf-reply-card">
      <div className="cf-reply-header">
        <Avatar src={avatarSrc} name={reply.author_name} size={26} />
        <span className="cf-reply-author">{reply.author_name}</span>
        <span className="cf-reply-time">{formatRelativeTime(reply.created_at)}</span>
        {isOwner && (
          <button
            className="cf-icon-btn cf-icon-btn--danger cf-reply-delete"
            onClick={() => onDelete(reply)}
            title="Delete reply"
            aria-label="Delete reply"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>
      {reply.text && <p className="cf-reply-text">{reply.text}</p>}
      <ImageGrid images={reply.images} onOpenFile={onOpenFile} />
    </div>
  );
}

// ── Animated tab bar ───────────────────────────────────────────────────────────
function TabBar({ tab, onTabChange, view }) {
  if (view !== 'list') return null;
  return (
    <div className="cf-panel-tabs" role="tablist">
      <button
        role="tab"
        aria-selected={tab === 'feed'}
        className={`cf-tab-btn${tab === 'feed' ? ' cf-tab-btn--active' : ''}`}
        onClick={() => onTabChange('feed')}
      >
        Feed
      </button>
      <button
        role="tab"
        aria-selected={tab === 'mine'}
        className={`cf-tab-btn${tab === 'mine' ? ' cf-tab-btn--active' : ''}`}
        onClick={() => onTabChange('mine')}
      >
        My Doubts
      </button>
      {/* Sliding indicator */}
      <span
        className="cf-tab-indicator"
        style={{ transform: `translateX(${tab === 'feed' ? '0%' : '100%'})` }}
        aria-hidden="true"
      />
    </div>
  );
}

// ── Main ConfusionPanel ────────────────────────────────────────────────────────
export default function ConfusionPanel({
  examId,
  examName,
  currentUser,
  suggestionUploadFolder,
  highlightPostId = null,
  onOpenFile = null,
  onClose,
}) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('feed');            // 'feed' | 'mine'
  const [view, setView] = useState('list');           // 'list' | 'detail'
  const [activePost, setActivePost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerMode, setComposerMode] = useState('post');
  const [editingPost, setEditingPost] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const deepLinkHandled = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // ── Load posts ───────────────────────────────────────────────────────────────
  // silent=true → update posts without showing a loading spinner (preserves tab & scroll)
  const loadPosts = useCallback(async (silent = false) => {
    if (!examId) return;
    if (!silent) {
      setLoading(true);
      setPosts([]);
    }
    try {
      const data = await fetchPosts(examId);
      setPosts(data);
    } catch (err) {
      console.error('loadPosts failed:', err);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  // Initial load — show spinner
  useEffect(() => {
    loadPosts(false);
  }, [loadPosts]);

  // Realtime subscription — silent refresh (preserves active tab & scroll position)
  useEffect(() => {
    if (!examId) return;
    const unsub = subscribeToConfusions(examId, () => loadPosts(true));
    return unsub;
  }, [examId, loadPosts]);

  // ── History / back support ───────────────────────────────────────────────────
  useEffect(() => {
    window.history.pushState({ confusionPanel: true, examId, view: 'list' }, '');

    const onPopState = (e) => {
      const s = e.state;

      // If returning from ViewerModal (viewerOpen state popped)
      if (s?.viewerOpen) return;

      if (s?.confusionPanel) {
        if (s?.view === 'detail') {
          setView('detail');
        } else {
          setView('list');
          setActivePost(null);
          setReplies([]);
        }
      } else if (s?.examPanel) {
        onCloseRef.current();
      } else {
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [examId]);

  // ── Deep-link: auto-open detail if highlightPostId present ──────────────────
  useEffect(() => {
    if (!highlightPostId || posts.length === 0 || deepLinkHandled.current) return;
    const target = posts.find(p => p.id === highlightPostId);
    if (target) {
      deepLinkHandled.current = true;
      openDetail(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightPostId, posts]);

  // ── Load replies ─────────────────────────────────────────────────────────────
  const loadReplies = useCallback(async (postId, silent = false) => {
    if (!silent) setRepliesLoading(true);
    try {
      const data = await fetchReplies(postId);
      setReplies(data);
    } catch (err) {
      console.error('loadReplies failed:', err);
    } finally {
      setRepliesLoading(false);
    }
  }, []);

  // ── Open detail view ─────────────────────────────────────────────────────────
  const openDetail = (post) => {
    setActivePost(post);
    setView('detail');
    setReplies([]);
    loadReplies(post.id);
    window.history.pushState({ confusionPanel: true, examId, view: 'detail', postId: post.id }, '');
  };

  const backToList = () => window.history.back();

  // ── Composer submit ───────────────────────────────────────────────────────────
  const handleComposerSubmit = async ({ text, images }) => {
    if (!currentUser) return;
    try {
      if (editingPost) {
        await updatePost(examId, editingPost.id, { text, images });
        if (activePost?.id === editingPost.id) {
          setActivePost(prev => ({ ...prev, text: text || null, images }));
        }
        await loadPosts(true); // silent
      } else if (composerMode === 'post') {
        await createPost(examId, { text, images }, currentUser);
        await loadPosts(true); // silent
      } else {
        await createReply(activePost.id, { text, images }, currentUser);
        await loadReplies(activePost.id, true); // silent reply refresh
        await loadPosts(true); // silent post refresh (reply count)
      }
    } catch (err) {
      console.error('Composer submit failed:', err);
    } finally {
      setComposerOpen(false);
      setEditingPost(null);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget || deleteLoading) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === 'post') {
        await deleteConfusionImages(deleteTarget.item.images || []);
        await deletePost(examId, deleteTarget.item.id);
        await loadPosts(true);
        if (activePost?.id === deleteTarget.item.id) {
          setView('list');
          setActivePost(null);
        }
      } else {
        await deleteConfusionImages(deleteTarget.item.images || []);
        await deleteReply(deleteTarget.item.post_id, deleteTarget.item.id);
        await loadReplies(activePost.id, true);
        await loadPosts(true);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  const visiblePosts = tab === 'mine'
    ? posts.filter(p => p.author_id === currentUser?.id)
    : posts;

  return (
    <div className="cf-panel">

      {/* ── Header row: back + title ──────────────────────────────────────── */}
      <div className="cf-panel-header">
        <button
          className="cf-panel-back"
          onClick={view === 'detail' ? backToList : onClose}
          aria-label={view === 'detail' ? 'Back to list' : 'Close Confusions'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="cf-panel-title-area">
          <span className="cf-panel-title">Confusions</span>
          {view === 'detail' && activePost && (
            <span className="cf-panel-subtitle">{activePost.author_name}'s doubt</span>
          )}
        </div>
      </div>

      {/* ── Animated tab bar — below the title, only in list view ─────────── */}
      <TabBar tab={tab} onTabChange={setTab} view={view} />

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="cf-panel-scroll">

        {/* ─── LIST VIEW ───────────────────────────────────────────────────── */}
        {view === 'list' && (
          <>
            {loading ? (
              <div className="cf-loading">
                <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
              </div>
            ) : visiblePosts.length === 0 ? (
              <div className="cf-empty">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="cf-empty-title">
                  {tab === 'mine' ? "You haven't posted yet" : 'No doubts yet'}
                </p>
                <p className="cf-empty-sub">
                  {tab === 'mine' ? 'Tap + to ask your first question.' : 'Be the first to start a discussion.'}
                </p>
              </div>
            ) : (
              <div className="cf-post-list">
                {visiblePosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUser?.id}
                    currentUser={currentUser}
                    tab={tab}
                    examId={examId}
                    onOpen={openDetail}
                    onEdit={(p) => { setEditingPost(p); setComposerMode('post'); setComposerOpen(true); }}
                    onDelete={(p) => setDeleteTarget({ type: 'post', item: p })}
                    onOpenFile={onOpenFile}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ─── DETAIL VIEW ─────────────────────────────────────────────────── */}
        {view === 'detail' && activePost && (
          <div className="cf-detail-view">
            {/* Full post */}
            <div className="cf-detail-post">
              <div className="cf-post-header" style={{ marginBottom: '10px' }}>
                <Avatar
                  src={activePost.author_avatar || (currentUser?.id === activePost.author_id ? currentUser?.profile_picture : null)}
                  name={activePost.author_name}
                />
                <div className="cf-post-author-info">
                  <span className="cf-post-author-name">{activePost.author_name}</span>
                  <span className="cf-post-time">{formatRelativeTime(activePost.created_at)}</span>
                </div>
                {activePost.status === 'solved' && (
                  <span className="cf-solved-badge" style={{ marginLeft: 'auto' }}>Solved</span>
                )}
              </div>
              {activePost.text && <p className="cf-detail-text">{activePost.text}</p>}
              <ImageGrid images={activePost.images} onOpenFile={onOpenFile} />
              <div className="cf-post-stats" style={{ marginTop: '12px' }}>
                <span className="cf-stat-pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                  {activePost.helpful ?? 0} helpful
                </span>
              </div>
            </div>

            {/* Reply section label */}
            <div className="cf-replies-label">
              <span>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
              <div className="cf-replies-label-line" />
            </div>

            {/* Replies */}
            {repliesLoading ? (
              <div className="cf-loading">
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
              </div>
            ) : replies.length === 0 ? (
              <p className="cf-no-replies">No replies yet. Be the first to help!</p>
            ) : (
              <div className="cf-replies-list">
                {replies.map(reply => (
                  <ReplyCard
                    key={reply.id}
                    reply={reply}
                    currentUserId={currentUser?.id}
                    currentUser={currentUser}
                    onDelete={(r) => setDeleteTarget({ type: 'reply', item: r })}
                    onOpenFile={onOpenFile}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── FAB ───────────────────────────────────────────────────────────── */}
      {currentUser ? (
        <button
          className="cf-fab"
          onClick={() => {
            setComposerMode(view === 'detail' ? 'reply' : 'post');
            setEditingPost(null);
            setComposerOpen(true);
          }}
          aria-label={view === 'detail' ? 'Write a reply' : 'Post a doubt'}
          title={view === 'detail' ? 'Write a reply' : 'Post a doubt'}
        >
          {view === 'detail' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7" />
              <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
        </button>
      ) : (
        <div className="cf-guest-bar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Log in to post or reply</span>
        </div>
      )}

      {/* ── Composer ──────────────────────────────────────────────────────── */}
      <ConfusionComposer
        open={composerOpen}
        mode={composerMode}
        editingPost={editingPost}
        examId={examId}
        examName={examName}
        suggestionUploadFolder={suggestionUploadFolder}
        onSubmit={handleComposerSubmit}
        onClose={() => { setComposerOpen(false); setEditingPost(null); }}
      />

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="sugg-modal-backdrop" onClick={() => !deleteLoading && setDeleteTarget(null)}>
          <div className="sugg-confirm-sheet" onClick={e => e.stopPropagation()}>
            <p className="sugg-confirm-text">
              {deleteTarget.type === 'post' ? 'Delete this doubt?' : 'Delete this reply?'}
            </p>
            {(deleteTarget.item.images?.filter(i => i?.uploaded).length > 0) && (
              <p style={{ fontSize: '12px', color: 'var(--accent)', margin: '-4px 0 8px', lineHeight: 1.5 }}>
                {deleteTarget.item.images.filter(i => i?.uploaded).length} attached image
                {deleteTarget.item.images.filter(i => i?.uploaded).length !== 1 ? 's' : ''} will also be removed from Drive.
              </p>
            )}
            <div className="sugg-confirm-actions">
              <button className="sugg-cancel-btn" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Cancel</button>
              <button className="sugg-submit-btn sugg-submit-btn--danger" onClick={confirmDelete} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
