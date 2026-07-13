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

  if (error) throw error;
  return (data || []).map(rowToFolder);
}

export async function saveAllFolders(folders) {
  writeLocalFolders(folders);

  if (!isSupabaseConfigured()) return folders;

  const rows = folders.map((folder, index) => folderToRow(folder, index));

  const { error: deleteError } = await supabase
    .from('drive_folders')
    .delete()
    .neq('id', '');

  if (deleteError) throw deleteError;

  if (rows.length) {
    const { error: insertError } = await supabase.from('drive_folders').insert(rows);
    if (insertError) throw insertError;
  }

  return folders;
}

export async function migrateFoldersFromLocalStorage() {
  if (!isSupabaseConfigured()) return;

  const { count, error: countError } = await supabase
    .from('drive_folders')
    .select('*', { count: 'exact', head: true });

  if (countError) throw countError;
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
