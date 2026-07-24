import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_GLIMPSES_KEY = 'bahattor_glimpses';
const STORAGE_VIEWS_KEY    = 'bahattor_glimpse_views';
const TWELVE_HOURS_MS      = 12 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getNowUTC() {
  return new Date().getTime();
}

function isGlimpseActive(createdAtStr) {
  if (!createdAtStr) return false;
  const createdTime = new Date(createdAtStr).getTime();
  if (isNaN(createdTime)) return false;
  return (getNowUTC() - createdTime) < TWELVE_HOURS_MS;
}

function isTableMissingError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist') ||
    error.code === 'PGRST205' ||
    error.code === '42P01'
  );
}

// ── LocalStorage Mock Helpers ────────────────────────────────────────────────

function readLocalGlimpses() {
  try {
    const raw = localStorage.getItem(STORAGE_GLIMPSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalGlimpses(list) {
  localStorage.setItem(STORAGE_GLIMPSES_KEY, JSON.stringify(list));
}

function readLocalViews() {
  try {
    const raw = localStorage.getItem(STORAGE_VIEWS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalViews(list) {
  localStorage.setItem(STORAGE_VIEWS_KEY, JSON.stringify(list));
}

function notifyLocalChange() {
  try {
    window.dispatchEvent(new Event('storage'));
    new BroadcastChannel('bahattor_glimpses_channel').postMessage({ type: 'glimpses_updated' });
  } catch (_) {}
}

// ── Fallback Implementations ────────────────────────────────────────────────

function createGlimpseLocally(glimpse) {
  const local = readLocalGlimpses();
  local.unshift(glimpse);
  writeLocalGlimpses(local);
  notifyLocalChange();
  return glimpse;
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * 3.1 createGlimpse(uploaderId, imageUrl, caption)
 */
export async function createGlimpse(uploaderId, imageUrl, caption = null) {
  const cleanCaption = caption && caption.trim() ? caption.trim().slice(0, 25) : null;
  const glimpseId = `glimpse_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowStr = new Date().toISOString();

  const glimpse = {
    id: glimpseId,
    uploader_id: uploaderId,
    uploaderId: uploaderId,
    image_url: imageUrl,
    imageUrl: imageUrl,
    caption: cleanCaption,
    created_at: nowStr,
    createdAt: nowStr,
    view_count: 0,
    viewCount: 0,
    reaction_counts: { love: 0, happy: 0, sad: 0, angry: 0 },
    reactionCounts: { love: 0, happy: 0, sad: 0, angry: 0 }
  };

  if (!isSupabaseConfigured()) {
    return createGlimpseLocally(glimpse);
  }

  try {
    const { error } = await supabase.from('glimpses').insert([{
      id: glimpse.id,
      uploader_id: uploaderId,
      image_url: imageUrl,
      caption: cleanCaption,
      created_at: nowStr,
      view_count: 0,
      reaction_counts: { love: 0, happy: 0, sad: 0, angry: 0 }
    }]);

    if (error) {
      if (isTableMissingError(error)) {
        console.warn('Glimpse table missing in Supabase. Falling back to local storage.');
        return createGlimpseLocally(glimpse);
      }
      throw new Error(error.message);
    }

    notifyLocalChange();
    return glimpse;
  } catch (err) {
    if (isTableMissingError(err)) {
      console.warn('Glimpse table missing in Supabase. Falling back to local storage.');
      return createGlimpseLocally(glimpse);
    }
    throw err;
  }
}

/**
 * 3.2 deleteGlimpse(glimpseId, requesterId)
 */
export async function deleteGlimpse(glimpseId, requesterId) {
  if (!isSupabaseConfigured()) {
    const localGlimpses = readLocalGlimpses().filter(g => g.id !== glimpseId);
    const localViews = readLocalViews().filter(v => v.glimpse_id !== glimpseId && v.glimpseId !== glimpseId);
    writeLocalGlimpses(localGlimpses);
    writeLocalViews(localViews);
    notifyLocalChange();
    return true;
  }

  try {
    await supabase.from('glimpse_views').delete().eq('glimpse_id', glimpseId);
    const { error } = await supabase.from('glimpses').delete().eq('id', glimpseId).eq('uploader_id', requesterId);
    if (error) {
      if (isTableMissingError(error)) {
        const localGlimpses = readLocalGlimpses().filter(g => g.id !== glimpseId);
        writeLocalGlimpses(localGlimpses);
        notifyLocalChange();
        return true;
      }
      throw new Error(error.message);
    }
    notifyLocalChange();
    return true;
  } catch (err) {
    const localGlimpses = readLocalGlimpses().filter(g => g.id !== glimpseId);
    writeLocalGlimpses(localGlimpses);
    notifyLocalChange();
    return true;
  }
}

/**
 * 3.3 getTrayForViewer(viewerId)
 */
export async function getTrayForViewer(viewerId) {
  let activeGlimpses = [];
  let burnedViewIds = new Set();
  let studentsMap = new Map();

  const getLocalTray = () => {
    const allGlimpses = readLocalGlimpses();
    activeGlimpses = allGlimpses.filter(g => isGlimpseActive(g.created_at || g.createdAt));
    const views = readLocalViews();
    views.forEach(v => {
      if ((v.viewer_id === viewerId || v.viewerId === viewerId)) {
        burnedViewIds.add(v.glimpse_id || v.glimpseId);
      }
    });
    try {
      const mockStudents = JSON.parse(localStorage.getItem('bahattor_mock_students') || '[]');
      mockStudents.forEach(s => studentsMap.set(s.id, s));
      const loggedIn = JSON.parse(localStorage.getItem('bahattor_logged_in_student') || 'null');
      if (loggedIn) studentsMap.set(loggedIn.id, loggedIn);
    } catch (_) {}

    const unburned = activeGlimpses.filter(g => !burnedViewIds.has(g.id));
    const grouped = new Map();
    unburned.forEach(g => {
      const upId = g.uploader_id || g.uploaderId;
      if (!grouped.has(upId)) grouped.set(upId, []);
      grouped.get(upId).push(g);
    });

    const tray = [];
    grouped.forEach((glimpsesList, uploaderId) => {
      let newestCreatedAt = '';
      glimpsesList.forEach(g => {
        const t = g.created_at || g.createdAt;
        if (!newestCreatedAt || new Date(t) > new Date(newestCreatedAt)) {
          newestCreatedAt = t;
        }
      });
      tray.push({
        uploaderId,
        newestCreatedAt,
        count: glimpsesList.length,
        student: studentsMap.get(uploaderId) || { id: uploaderId, name: 'Student' }
      });
    });
    tray.sort((a, b) => new Date(b.newestCreatedAt) - new Date(a.newestCreatedAt));
    return tray;
  };

  if (!isSupabaseConfigured()) {
    return getLocalTray();
  }

  try {
    const twelveHoursAgo = new Date(Date.now() - TWELVE_HOURS_MS).toISOString();
    const { data: glimpsesData, error: glimpseErr } = await supabase
      .from('glimpses')
      .select('*')
      .gte('created_at', twelveHoursAgo)
      .order('created_at', { ascending: false });

    if (glimpseErr) {
      if (isTableMissingError(glimpseErr)) return getLocalTray();
      throw new Error(glimpseErr.message);
    }
    activeGlimpses = glimpsesData || [];

    if (viewerId) {
      const { data: viewsData } = await supabase
        .from('glimpse_views')
        .select('glimpse_id')
        .eq('viewer_id', viewerId);

      (viewsData || []).forEach(v => burnedViewIds.add(v.glimpse_id));
    }

    const uploaderIds = Array.from(new Set(activeGlimpses.map(g => g.uploader_id || g.uploaderId)));
    if (uploaderIds.length > 0) {
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, name, class_roll, registration_number, profile_picture')
        .in('id', uploaderIds);
      (studentsData || []).forEach(s => studentsMap.set(s.id, s));
    }
    // Merge local student details for fallback
    try {
      const mockStudents = JSON.parse(localStorage.getItem('bahattor_mock_students') || '[]');
      mockStudents.forEach(s => studentsMap.set(s.id, s));
      const loggedIn = JSON.parse(localStorage.getItem('bahattor_logged_in_student') || 'null');
      if (loggedIn) studentsMap.set(loggedIn.id, loggedIn);
    } catch (_) {}
  } catch (err) {
    if (isTableMissingError(err)) return getLocalTray();
    console.error('Tray fetch error:', err);
    return getLocalTray();
  }

  const unburned = activeGlimpses.filter(g => !burnedViewIds.has(g.id));
  const grouped = new Map();
  unburned.forEach(g => {
    const upId = g.uploader_id || g.uploaderId;
    if (!grouped.has(upId)) grouped.set(upId, []);
    grouped.get(upId).push(g);
  });

  const tray = [];
  grouped.forEach((glimpsesList, uploaderId) => {
    let newestCreatedAt = '';
    glimpsesList.forEach(g => {
      const t = g.created_at || g.createdAt;
      if (!newestCreatedAt || new Date(t) > new Date(newestCreatedAt)) {
        newestCreatedAt = t;
      }
    });

    tray.push({
      uploaderId,
      newestCreatedAt,
      count: glimpsesList.length,
      student: studentsMap.get(uploaderId) || { id: uploaderId, name: 'Student' }
    });
  });

  tray.sort((a, b) => new Date(b.newestCreatedAt) - new Date(a.newestCreatedAt));
  return tray;
}

/**
 * 3.4 openGlimpseStack(viewerId, uploaderId)
 */
export async function openGlimpseStack(viewerId, uploaderId) {
  let activeGlimpses = [];
  let burnedViewIds = new Set();
  let uploaderStudent = null;

  const getLocalStack = () => {
    const allGlimpses = readLocalGlimpses();
    activeGlimpses = allGlimpses.filter(g =>
      (g.uploader_id === uploaderId || g.uploaderId === uploaderId) &&
      isGlimpseActive(g.created_at || g.createdAt)
    );
    const views = readLocalViews();
    views.forEach(v => {
      if ((v.viewer_id === viewerId || v.viewerId === viewerId)) {
        burnedViewIds.add(v.glimpse_id || v.glimpseId);
      }
    });
    try {
      const mockStudents = JSON.parse(localStorage.getItem('bahattor_mock_students') || '[]');
      uploaderStudent = mockStudents.find(s => s.id === uploaderId) || null;
      if (!uploaderStudent) {
        const loggedIn = JSON.parse(localStorage.getItem('bahattor_logged_in_student') || 'null');
        if (loggedIn && loggedIn.id === uploaderId) {
          uploaderStudent = loggedIn;
        }
      }
    } catch (_) {}

    const unburned = activeGlimpses.filter(g => !burnedViewIds.has(g.id));
    unburned.sort((a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt));
    return {
      glimpses: unburned.map(g => ({
        id: g.id,
        uploaderId: g.uploader_id || g.uploaderId,
        imageUrl: g.image_url || g.imageUrl,
        caption: g.caption || null,
        createdAt: g.created_at || g.createdAt,
        viewCount: g.view_count ?? g.viewCount ?? 0,
        reactionCounts: g.reaction_counts || g.reactionCounts || { love: 0, happy: 0, sad: 0, angry: 0 }
      })),
      uploaderStudent: uploaderStudent || { id: uploaderId, name: 'Student' }
    };
  };

  if (!isSupabaseConfigured()) {
    return getLocalStack();
  }

  try {
    const twelveHoursAgo = new Date(Date.now() - TWELVE_HOURS_MS).toISOString();
    const { data: glimpsesData, error: glimpseErr } = await supabase
      .from('glimpses')
      .select('*')
      .eq('uploader_id', uploaderId)
      .gte('created_at', twelveHoursAgo)
      .order('created_at', { ascending: true });

    if (glimpseErr) {
      if (isTableMissingError(glimpseErr)) return getLocalStack();
      throw new Error(glimpseErr.message);
    }
    activeGlimpses = glimpsesData || [];

    if (viewerId) {
      const { data: viewsData } = await supabase
        .from('glimpse_views')
        .select('glimpse_id, reaction')
        .eq('viewer_id', viewerId);

      (viewsData || []).forEach(v => burnedViewIds.add(v.glimpse_id));
    }

    const { data: sData } = await supabase
      .from('students')
      .select('id, name, class_roll, registration_number, profile_picture')
      .eq('id', uploaderId)
      .maybeSingle();

    uploaderStudent = sData || null;
    if (!uploaderStudent) {
      const loggedIn = JSON.parse(localStorage.getItem('bahattor_logged_in_student') || 'null');
      if (loggedIn && loggedIn.id === uploaderId) {
        uploaderStudent = loggedIn;
      }
    }
  } catch (err) {
    if (isTableMissingError(err)) return getLocalStack();
    return getLocalStack();
  }

  const unburned = activeGlimpses.filter(g => !burnedViewIds.has(g.id));
  unburned.sort((a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt));

  return {
    glimpses: unburned.map(g => ({
      id: g.id,
      uploaderId: g.uploader_id || g.uploaderId,
      imageUrl: g.image_url || g.imageUrl,
      caption: g.caption || null,
      createdAt: g.created_at || g.createdAt,
      viewCount: g.view_count ?? g.viewCount ?? 0,
      reactionCounts: g.reaction_counts || g.reactionCounts || { love: 0, happy: 0, sad: 0, angry: 0 }
    })),
    uploaderStudent: uploaderStudent || { id: uploaderId, name: 'Student' }
  };
}

/**
 * 3.5 burnGlimpseView(glimpseId, viewerId)
 */
export async function burnGlimpseView(glimpseId, viewerId) {
  if (!viewerId || !glimpseId) return;

  const nowStr = new Date().toISOString();
  const viewId = `view_${glimpseId}_${viewerId}`;

  const burnLocally = () => {
    const views = readLocalViews();
    if (views.some(v => (v.glimpse_id === glimpseId || v.glimpseId === glimpseId) && (v.viewer_id === viewerId || v.viewerId === viewerId))) {
      return;
    }
    views.push({ id: viewId, glimpse_id: glimpseId, viewer_id: viewerId, viewed_at: nowStr, reaction: null });
    writeLocalViews(views);

    const glimpses = readLocalGlimpses();
    const g = glimpses.find(item => item.id === glimpseId);
    if (g) {
      g.view_count = (g.view_count || g.viewCount || 0) + 1;
      g.viewCount = g.view_count;
      writeLocalGlimpses(glimpses);
    }
    notifyLocalChange();
  };

  if (!isSupabaseConfigured()) {
    return burnLocally();
  }

  try {
    const { data: existing } = await supabase
      .from('glimpse_views')
      .select('id')
      .eq('glimpse_id', glimpseId)
      .eq('viewer_id', viewerId)
      .maybeSingle();

    if (existing) return;

    const { error: viewErr } = await supabase.from('glimpse_views').insert([{
      id: viewId,
      glimpse_id: glimpseId,
      viewer_id: viewerId,
      viewed_at: nowStr,
      reaction: null
    }]);

    if (viewErr) {
      if (isTableMissingError(viewErr)) return burnLocally();
    }

    const { data: gData } = await supabase.from('glimpses').select('view_count').eq('id', glimpseId).maybeSingle();
    if (gData) {
      const newCount = (gData.view_count || 0) + 1;
      await supabase.from('glimpses').update({ view_count: newCount }).eq('id', glimpseId);
    }

    notifyLocalChange();
  } catch (err) {
    burnLocally();
  }
}

/**
 * 3.6 reactToGlimpse(glimpseId, viewerId, reactionType)
 */
export async function reactToGlimpse(glimpseId, viewerId, reactionType) {
  if (!viewerId || !glimpseId) return;

  const validTypes = ['love', 'happy', 'sad', 'angry'];
  if (!validTypes.includes(reactionType)) return;

  const nowStr = new Date().toISOString();
  const viewId = `view_${glimpseId}_${viewerId}`;

  const reactLocally = () => {
    const views = readLocalViews();
    let view = views.find(v => (v.glimpse_id === glimpseId || v.glimpseId === glimpseId) && (v.viewer_id === viewerId || v.viewerId === viewerId));
    let prevReaction = view ? view.reaction : null;
    let nextReaction = prevReaction === reactionType ? null : reactionType;

    if (!view) {
      view = { id: viewId, glimpse_id: glimpseId, viewer_id: viewerId, viewed_at: nowStr, reaction: nextReaction };
      views.push(view);
    } else {
      view.reaction = nextReaction;
    }
    writeLocalViews(views);

    const glimpses = readLocalGlimpses();
    const g = glimpses.find(item => item.id === glimpseId);
    if (g) {
      const counts = g.reaction_counts || g.reactionCounts || { love: 0, happy: 0, sad: 0, angry: 0 };
      if (prevReaction && counts[prevReaction] > 0) counts[prevReaction]--;
      if (nextReaction) counts[nextReaction] = (counts[nextReaction] || 0) + 1;
      g.reaction_counts = counts;
      g.reactionCounts = counts;
      writeLocalGlimpses(glimpses);
    }
    notifyLocalChange();
    return nextReaction;
  };

  if (!isSupabaseConfigured()) {
    return reactLocally();
  }

  try {
    const { data: existingView } = await supabase
      .from('glimpse_views')
      .select('*')
      .eq('glimpse_id', glimpseId)
      .eq('viewer_id', viewerId)
      .maybeSingle();

    let prevReaction = existingView ? existingView.reaction : null;
    let nextReaction = prevReaction === reactionType ? null : reactionType;

    if (!existingView) {
      await supabase.from('glimpse_views').insert([{
        id: viewId,
        glimpse_id: glimpseId,
        viewer_id: viewerId,
        viewed_at: nowStr,
        reaction: nextReaction
      }]);
    } else {
      await supabase.from('glimpse_views').update({ reaction: nextReaction }).eq('id', existingView.id);
    }

    const { data: glimpseData } = await supabase.from('glimpses').select('reaction_counts').eq('id', glimpseId).maybeSingle();
    if (glimpseData) {
      const counts = glimpseData.reaction_counts || { love: 0, happy: 0, sad: 0, angry: 0 };
      if (prevReaction && counts[prevReaction] > 0) counts[prevReaction]--;
      if (nextReaction) counts[nextReaction] = (counts[nextReaction] || 0) + 1;
      await supabase.from('glimpses').update({ reaction_counts: counts }).eq('id', glimpseId);
    }

    notifyLocalChange();
    return nextReaction;
  } catch (err) {
    return reactLocally();
  }
}

/**
 * 3.7 getGlimpsesForUploader(uploaderId)
 */
export async function getGlimpsesForUploader(uploaderId) {
  if (!uploaderId) return [];

  const getLocalUploaderGlimpses = () => {
    const all = readLocalGlimpses();
    return all.filter(g =>
      (g.uploader_id === uploaderId || g.uploaderId === uploaderId) &&
      isGlimpseActive(g.created_at || g.createdAt)
    ).map(g => ({
      id: g.id,
      uploaderId: g.uploader_id || g.uploaderId,
      imageUrl: g.image_url || g.imageUrl,
      caption: g.caption || null,
      createdAt: g.created_at || g.createdAt,
      viewCount: g.view_count ?? g.viewCount ?? 0,
      reactionCounts: g.reaction_counts || g.reactionCounts || { love: 0, happy: 0, sad: 0, angry: 0 }
    }));
  };

  if (!isSupabaseConfigured()) {
    return getLocalUploaderGlimpses();
  }

  try {
    const twelveHoursAgo = new Date(Date.now() - TWELVE_HOURS_MS).toISOString();
    const { data, error } = await supabase
      .from('glimpses')
      .select('*')
      .eq('uploader_id', uploaderId)
      .gte('created_at', twelveHoursAgo)
      .order('created_at', { ascending: false });

    if (error) {
      if (isTableMissingError(error)) return getLocalUploaderGlimpses();
      throw new Error(error.message);
    }

    return (data || []).map(g => ({
      id: g.id,
      uploaderId: g.uploader_id || g.uploaderId,
      imageUrl: g.image_url || g.imageUrl,
      caption: g.caption || null,
      createdAt: g.created_at || g.createdAt,
      viewCount: g.view_count ?? g.viewCount ?? 0,
      reactionCounts: g.reaction_counts || g.reactionCounts || { love: 0, happy: 0, sad: 0, angry: 0 }
    }));
  } catch (err) {
    if (isTableMissingError(err)) return getLocalUploaderGlimpses();
    return getLocalUploaderGlimpses();
  }
}

/**
 * Realtime Subscription
 */
export function subscribeToGlimpses(onChange) {
  if (!isSupabaseConfigured()) {
    const handler = () => onChange();
    window.addEventListener('storage', handler);
    let channel;
    try {
      channel = new BroadcastChannel('bahattor_glimpses_channel');
      channel.onmessage = handler;
    } catch (_) {}

    return () => {
      window.removeEventListener('storage', handler);
      if (channel) channel.close();
    };
  }

  const channel = supabase
    .channel('glimpses_realtime_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'glimpses' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'glimpse_views' }, () => onChange())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Fetch all unburned glimpses from all users grouped by uploader.
 */
export async function getAllUnburnedGlimpses(viewerId) {
  let activeGlimpses = [];
  let burnedViewIds = new Set();
  let studentsMap = new Map();

  const getLocalData = () => {
    const allGlimpses = readLocalGlimpses();
    activeGlimpses = allGlimpses.filter(g => isGlimpseActive(g.created_at || g.createdAt));
    const views = readLocalViews();
    views.forEach(v => {
      if ((v.viewer_id === viewerId || v.viewerId === viewerId)) {
        burnedViewIds.add(v.glimpse_id || v.glimpseId);
      }
    });

    try {
      const mockStudents = JSON.parse(localStorage.getItem('bahattor_mock_students') || '[]');
      mockStudents.forEach(s => studentsMap.set(s.id, s));
      const loggedIn = JSON.parse(localStorage.getItem('bahattor_logged_in_student') || 'null');
      if (loggedIn) studentsMap.set(loggedIn.id, loggedIn);
    } catch (_) {}
  };

  if (!isSupabaseConfigured()) {
    getLocalData();
  } else {
    try {
      const twelveHoursAgo = new Date(Date.now() - TWELVE_HOURS_MS).toISOString();
      const { data: glimpsesData, error: glimpseErr } = await supabase
        .from('glimpses')
        .select('*')
        .gte('created_at', twelveHoursAgo)
        .order('created_at', { ascending: true }); // chronological order

      if (glimpseErr) {
        if (isTableMissingError(glimpseErr)) getLocalData();
        else throw new Error(glimpseErr.message);
      } else {
        activeGlimpses = glimpsesData || [];
      }

      if (viewerId) {
        const { data: viewsData } = await supabase
          .from('glimpse_views')
          .select('glimpse_id')
          .eq('viewer_id', viewerId);

        (viewsData || []).forEach(v => burnedViewIds.add(v.glimpse_id));
      }

      const uploaderIds = Array.from(new Set(activeGlimpses.map(g => g.uploader_id || g.uploaderId)));
      if (uploaderIds.length > 0) {
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, name, class_roll, registration_number, profile_picture')
          .in('id', uploaderIds);

        (studentsData || []).forEach(s => studentsMap.set(s.id, s));
      }
      
      // Merge local student cache
      try {
        const mockStudents = JSON.parse(localStorage.getItem('bahattor_mock_students') || '[]');
        mockStudents.forEach(s => studentsMap.set(s.id, s));
        const loggedIn = JSON.parse(localStorage.getItem('bahattor_logged_in_student') || 'null');
        if (loggedIn) studentsMap.set(loggedIn.id, loggedIn);
      } catch (_) {}

    } catch (err) {
      if (isTableMissingError(err)) getLocalData();
      else console.error('Error fetching glimpses:', err);
    }
  }

  // Filter out burned glimpses AND owner's own glimpses (viewer cannot see their own glimpse in Explore stream)
  const unburned = activeGlimpses.filter(g => {
    const isBurned = burnedViewIds.has(g.id);
    const upId = g.uploader_id || g.uploaderId;
    const isOwnGlimpse = viewerId && (upId === viewerId);
    return !isBurned && !isOwnGlimpse;
  });

  // Group by uploader_id to keep a user's glimpses together
  const groups = new Map();
  unburned.forEach(g => {
    const upId = g.uploader_id || g.uploaderId;
    if (!groups.has(upId)) {
      groups.set(upId, []);
    }
    groups.get(upId).push(g);
  });

  // Flatten keeping uploader groups together, sorted chronologically within group
  const flattened = [];
  groups.forEach((list, uploaderId) => {
    // Sort oldest first within this uploader's group
    list.sort((a, b) => new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt));
    list.forEach(g => {
      flattened.push({
        id: g.id,
        uploaderId,
        imageUrl: g.image_url || g.imageUrl,
        caption: g.caption || null,
        createdAt: g.created_at || g.createdAt,
        viewCount: g.view_count ?? g.viewCount ?? 0,
        reactionCounts: g.reaction_counts || g.reactionCounts || { love: 0, happy: 0, sad: 0, angry: 0 },
        uploaderStudent: studentsMap.get(uploaderId) || { id: uploaderId, name: 'Student' }
      });
    });
  });

  return flattened;
}
