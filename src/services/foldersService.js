import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEFAULT_FOLDERS } from '../config/drive';

const STORAGE_KEY = 'studydock_configured_folders';

function rowToFolder(row) {
  return {
    id: row.id,
    name: row.name,
    folderId: row.folder_id,
    driveLink: row.drive_link || '',
  };
}

function folderToRow(folder, sortOrder = 0) {
  return {
    id: folder.id,
    name: folder.name,
    folder_id: folder.folderId,
    drive_link: folder.driveLink || '',
    sort_order: sortOrder,
  };
}

function readLocalFolders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_FOLDERS;
  } catch {
    return DEFAULT_FOLDERS;
  }
}

function writeLocalFolders(folders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
}

export async function fetchFolders() {
  if (!isSupabaseConfigured()) return readLocalFolders();

  const { data, error } = await supabase
    .from('drive_folders')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  const folders = (data || []).map(rowToFolder);
  writeLocalFolders(folders);
  return folders;
}

export async function saveAllFolders(folders) {
  writeLocalFolders(folders);

  if (!isSupabaseConfigured()) return folders;

  const rows = folders.map((folder, index) => folderToRow(folder, index));

  const { data: existing, error: fetchError } = await supabase
    .from('drive_folders')
    .select('id');

  if (fetchError) throw new Error(fetchError.message);

  const newIds = new Set(rows.map((row) => row.id));
  const idsToDelete = (existing || [])
    .map((row) => row.id)
    .filter((id) => !newIds.has(id));

  if (idsToDelete.length) {
    const { error: deleteError } = await supabase
      .from('drive_folders')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) throw new Error(deleteError.message);
  }

  if (rows.length) {
    const { error: upsertError } = await supabase
      .from('drive_folders')
      .upsert(rows, { onConflict: 'id' });

    if (upsertError) throw new Error(upsertError.message);
  }

  return folders;
}

export async function migrateFoldersFromLocalStorage() {
  if (!isSupabaseConfigured()) return;

  const { count, error: countError } = await supabase
    .from('drive_folders')
    .select('*', { count: 'exact', head: true });

  if (countError) throw new Error(countError.message);
  if (count > 0) return;

  const local = readLocalFolders();
  if (!local.length) return;

  await saveAllFolders(local);
}

export function subscribeToFolders(onChange) {
  if (!isSupabaseConfigured()) return () => {};

  const channel = supabase
    .channel('drive_folders_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'drive_folders' }, () => {
      onChange();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
