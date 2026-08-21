import React, { useState, useEffect, useCallback } from 'react';
import { fetchBroadcastNotifications } from '../../services/broadcastService';
import {
  fetchMyNotifications,
  dismissNotification,
  subscribeToMyNotifications,
} from '../../services/userNotificationService';

// ── Icons ─────────────────────────────────────────────────────────────────────

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function SuggestionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function ConfusionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}

// ── Avatar circle ─────────────────────────────────────────────────────────────

function NotifAvatar({ senderPhoto, senderName, type }) {
  if (senderPhoto) {
    return (
      <div className="notif-avatar notif-avatar--user">
        <img src={senderPhoto} alt={senderName || 'User'} className="notif-avatar-img" />
      </div>
    );
  }
  // System: pick icon by type
  const Icon = type === 'suggestion'
    ? SuggestionIcon
    : type === 'confusion_reply'
      ? ReplyIcon
      : type === 'confusion_post'
        ? ConfusionIcon
        : BellIcon;

  return (
    <div className="notif-avatar notif-avatar--system">
      <Icon />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(isoString) {
  if (!isoString) return '';
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatSubTime(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// ── Broadcast row (system broadcasts, no dismiss on these) ────────────────────

function BroadcastRow({ item }) {
  return (
    <div className="notif-row">
      <div className="notif-avatar notif-avatar--system">
        <BellIcon />
      </div>
      <div className="notif-row-content">
        <div className="notif-row-title">{item.title}</div>
        <div className="notif-row-sub">{formatSubTime(item.created_at)}</div>
      </div>
      <div className="notif-row-time">{relativeTime(item.created_at)}</div>
      {item.body && (
        <div className="notif-row-body">
          <div className="notif-row-body-inner">{item.body}</div>
        </div>
      )}
    </div>
  );
}

// ── User-activity notification row ────────────────────────────────────────────

function ActivityRow({ item, onDismiss }) {
  const handleClick = (e) => {
    // Don't navigate when clicking the dismiss button
    if (e.target.closest('.notif-dismiss-btn')) return;
    if (item.action_url) {
      window.location.href = item.action_url;
    }
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    onDismiss(item.id);
  };

  return (
    <div
      className="notif-row notif-row--clickable"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); }}
    >
      <NotifAvatar
        senderPhoto={item.sender_photo}
        senderName={item.sender_name}
        type={item.type}
      />

      <div className="notif-row-content">
        <div className="notif-row-title">
          {item.sender_name
            ? <><strong>{item.sender_name}</strong>{' '}{stripSenderFromTitle(item.title, item.sender_name)}</>
            : item.title
          }
        </div>
        <div className="notif-row-sub">{formatSubTime(item.created_at)}</div>
      </div>

      <div className="notif-row-time">{relativeTime(item.created_at)}</div>

      {/* Dismiss button */}
      <button
        className="notif-dismiss-btn"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {item.body && (
        <div className="notif-row-body">
          <div className="notif-row-body-inner">{item.body}</div>
        </div>
      )}
    </div>
  );
}

/** Strip leading "SenderName " from title string since we render it separately as bold. */
function stripSenderFromTitle(title = '', senderName = '') {
  if (!senderName) return title;
  const prefix = senderName + ' ';
  if (title.startsWith(prefix)) return title.slice(prefix.length);
  return title;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body }) {
  return (
    <div className="notification-empty-state">
      <div className="empty-icon-circle">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="notification-skeleton-list">
      {[0, 1, 2].map((i) => (
        <div className="notif-skeleton-row" key={i}>
          <div className="notif-skeleton-circle" />
          <div className="notif-skeleton-lines">
            <div className="notif-skeleton-line notif-skeleton-line--title" />
            <div className="notif-skeleton-line notif-skeleton-line--sub" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function NotificationPage({ currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('app');

  // Per-user activity notifications
  const [myNotifs, setMyNotifs]       = useState([]);
  const [myLoading, setMyLoading]     = useState(true);

  // Broadcast / system notifications
  const [broadcasts, setBroadcasts]   = useState([]);
  const [bcastLoading, setBcastLoading] = useState(true);

  // ── Load per-user notifications ─────────────────────────────────────────────
  const loadMyNotifs = useCallback(async () => {
    if (!currentUser?.id) { setMyLoading(false); return; }
    try {
      const data = await fetchMyNotifications(currentUser.id);
      setMyNotifs(data || []);
    } catch (err) {
      console.error('Failed to load my notifications:', err);
    } finally {
      setMyLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    setMyLoading(true);
    loadMyNotifs();
  }, [loadMyNotifs]);

  // Realtime subscription for per-user notifications
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = subscribeToMyNotifications(currentUser.id, loadMyNotifs);
    return unsub;
  }, [currentUser?.id, loadMyNotifs]);

  // ── Load broadcasts ─────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await fetchBroadcastNotifications();
        if (mounted) setBroadcasts(data || []);
      } catch (err) {
        console.error('Failed to load broadcasts:', err);
      } finally {
        if (mounted) setBcastLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // ── Dismiss ─────────────────────────────────────────────────────────────────
  const handleDismiss = useCallback(async (notifId) => {
    // Optimistically remove from UI
    setMyNotifs((prev) => prev.filter((n) => n.id !== notifId));
    try {
      await dismissNotification(notifId, currentUser?.id);
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
      // Reload on failure
      loadMyNotifs();
    }
  }, [currentUser?.id, loadMyNotifs]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="notification-page-container">

      {/* Header — clean title only */}
      <div className="notification-page-header--simple">
        <h2 className="notification-simple-title">Notification</h2>
      </div>

      {/* Segmented Slider */}
      <div className="notification-slider-wrapper">
        <div className={`notification-slider-track active-${activeSubTab}`}>
          <div className="slider-pill-indicator" />
          <button
            type="button"
            className={`slider-btn ${activeSubTab === 'app' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('app')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0" />
            </svg>
            <span>Notifications</span>
          </button>
          <button
            type="button"
            className={`slider-btn ${activeSubTab === 'official' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('official')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <span>Announcements</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="notification-content-area">

        {/* ── App Notifications tab ─────────────────────────────────────── */}
        {activeSubTab === 'app' && (
          <div className="subtab-panel fade-in-panel">
            {myLoading ? (
              <SkeletonList />
            ) : myNotifs.length > 0 ? (
              <div className="notification-feed">
                {myNotifs.map((item) => (
                  <ActivityRow
                    key={item.id}
                    item={item}
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<BellIcon />}
                title="No Notifications"
                body="You're all caught up! Activity from others will appear here."
              />
            )}
          </div>
        )}

        {/* ── Announcements tab ─────────────────────────────────────────── */}
        {activeSubTab === 'official' && (
          <div className="subtab-panel fade-in-panel">
            {bcastLoading ? (
              <SkeletonList />
            ) : broadcasts.length > 0 ? (
              <div className="notification-feed">
                {broadcasts.map((item) => (
                  <BroadcastRow key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                }
                title="No Announcements"
                body="Check back later for academic notices, exam updates, and department news."
              />
            )}
          </div>
        )}

      </div>
    </div>
  );
}
