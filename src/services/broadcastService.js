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
    .select("id, name, registration_number, class_roll, session")
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

export async function sendBroadcastNotification(title, body, target = "all") {
  const newNotif = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim(),
    body: body.trim(),
    target,
    created_at: new Date().toISOString(),
  };
  if (!isSupabaseConfigured()) {
    const list = await fetchBroadcastNotifications();
    list.unshift(newNotif);
    const pruned = list.slice(0, 20);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(pruned));
    window.dispatchEvent(new Event("storage"));
    return pruned;
  }
  const currentList = await fetchBroadcastNotifications();
  currentList.unshift(newNotif);
  const pruned = currentList.slice(0, 20);
  await saveSetting("broadcast_notifications", pruned);
  return pruned;
}
