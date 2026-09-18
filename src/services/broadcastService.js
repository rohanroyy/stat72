import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { fetchSetting, saveSetting } from "./settingsService";

const LOCAL_STORAGE_KEY = "bahattor_mock_broadcasts";

export async function fetchAllStudents() {
  if (!isSupabaseConfigured()) {
    try {
      const rawMock = localStorage.getItem("bahattor_mock_students") || "[]";
      return JSON.parse(rawMock);
    } catch {
      return [];
    }
  }
  const { data, error } = await supabase
    .from("students")
    .select("id, name, registration_number, class_roll, session, profile_picture")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}


export async function fetchBroadcastNotifications() {
  if (!isSupabaseConfigured()) {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }
  try {
    const list = await fetchSetting("broadcast_notifications");
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error("Failed to fetch broadcasts:", err);
    return [];
  }
}

export async function sendBroadcastNotification(title, body, target = "all", customId = null, actionUrl = null) {
  const notifId = customId || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newNotif = {
    id: notifId,
    title: title.trim(),
    body: body.trim(),
    target,
    action_url: actionUrl || null,
    created_at: new Date().toISOString(),
  };
  if (!isSupabaseConfigured()) {
    const list = await fetchBroadcastNotifications();
    if (customId && list.some(n => n.id === customId)) {
      return list;
    }
    list.unshift(newNotif);
    const pruned = list.slice(0, 20);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pruned));
    window.dispatchEvent(new Event("storage"));
    return pruned;
  }
  const currentList = await fetchBroadcastNotifications();
  if (customId && currentList.some(n => n.id === customId)) {
    return currentList;
  }
  currentList.unshift(newNotif);
  const pruned = currentList.slice(0, 20);
  await saveSetting("broadcast_notifications", pruned);
  return pruned;
}

export async function deleteBroadcastNotification(id) {
  if (!isSupabaseConfigured()) {
    const list = await fetchBroadcastNotifications();
    const filtered = list.filter(n => n.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("storage"));
    return filtered;
  }
  const currentList = await fetchBroadcastNotifications();
  const filtered = currentList.filter(n => n.id !== id);
  await saveSetting("broadcast_notifications", filtered);
  return filtered;
}
