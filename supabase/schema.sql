-- StudyDock Supabase schema
-- Run this in Supabase Dashboard → SQL Editor → New query

-- Exams (shared calendar data)
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT DEFAULT '',
  duration TEXT DEFAULT '',
  room TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exams_date_idx ON exams (date);

-- Google Drive folder links (admin-managed)
CREATE TABLE IF NOT EXISTS drive_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  drive_link TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS drive_folders_sort_idx ON drive_folders (sort_order);

-- App settings (API key, Telegram config, topic names, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Public read/write (admin access is gated in the app UI)
DROP POLICY IF EXISTS "exams_select" ON exams;
DROP POLICY IF EXISTS "exams_insert" ON exams;
DROP POLICY IF EXISTS "exams_update" ON exams;
DROP POLICY IF EXISTS "exams_delete" ON exams;

CREATE POLICY "exams_select" ON exams FOR SELECT USING (true);
CREATE POLICY "exams_insert" ON exams FOR INSERT WITH CHECK (true);
CREATE POLICY "exams_update" ON exams FOR UPDATE USING (true);
CREATE POLICY "exams_delete" ON exams FOR DELETE USING (true);

DROP POLICY IF EXISTS "drive_folders_select" ON drive_folders;
DROP POLICY IF EXISTS "drive_folders_insert" ON drive_folders;
DROP POLICY IF EXISTS "drive_folders_update" ON drive_folders;
DROP POLICY IF EXISTS "drive_folders_delete" ON drive_folders;

CREATE POLICY "drive_folders_select" ON drive_folders FOR SELECT USING (true);
CREATE POLICY "drive_folders_insert" ON drive_folders FOR INSERT WITH CHECK (true);
CREATE POLICY "drive_folders_update" ON drive_folders FOR UPDATE USING (true);
CREATE POLICY "drive_folders_delete" ON drive_folders FOR DELETE USING (true);

DROP POLICY IF EXISTS "app_settings_select" ON app_settings;
DROP POLICY IF EXISTS "app_settings_insert" ON app_settings;
DROP POLICY IF EXISTS "app_settings_update" ON app_settings;
DROP POLICY IF EXISTS "app_settings_delete" ON app_settings;

CREATE POLICY "app_settings_select" ON app_settings FOR SELECT USING (true);
CREATE POLICY "app_settings_insert" ON app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "app_settings_update" ON app_settings FOR UPDATE USING (true);
CREATE POLICY "app_settings_delete" ON app_settings FOR DELETE USING (true);

-- Realtime (run separately if the lines below fail — enable in Dashboard → Database → Replication)
-- ALTER PUBLICATION supabase_realtime ADD TABLE exams;
-- ALTER PUBLICATION supabase_realtime ADD TABLE drive_folders;
-- ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;

-- Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE confusion_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE confusion_replies;

-- Students (user profiles linked to auth.users)
CREATE TABLE IF NOT EXISTS students (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  dob DATE NOT NULL,
  gender TEXT NOT NULL,
  class_roll TEXT NOT NULL,
  registration_number TEXT NOT NULL UNIQUE,
  session TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL,
  mood TEXT DEFAULT NULL,
  mood_selected_at TIMESTAMPTZ DEFAULT NULL,
  profile_picture TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS students_reg_idx ON students (registration_number);

-- RLS for students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select_all" ON students;
DROP POLICY IF EXISTS "students_insert_own" ON students;
DROP POLICY IF EXISTS "students_update_own" ON students;

CREATE POLICY "students_select_all" ON students FOR SELECT USING (true);
CREATE POLICY "students_insert_own" ON students FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "students_update_own" ON students FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Migration: add profile_picture column if it does not already exist
-- Run this if you already created the students table before this update:
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_picture TEXT DEFAULT NULL;

-- ── Glimpse (Ephemeral Photo Sharing) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS glimpses (
  id TEXT PRIMARY KEY,
  uploader_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  view_count INTEGER DEFAULT 0,
  reaction_counts JSONB DEFAULT '{"love":0,"happy":0,"sad":0,"angry":0}'::jsonb
);

CREATE INDEX IF NOT EXISTS glimpses_created_idx ON glimpses (created_at);
CREATE INDEX IF NOT EXISTS glimpses_uploader_idx ON glimpses (uploader_id);

CREATE TABLE IF NOT EXISTS glimpse_views (
  id TEXT PRIMARY KEY,
  glimpse_id TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  reaction TEXT DEFAULT NULL,
  UNIQUE(glimpse_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS glimpse_views_lookup_idx ON glimpse_views (glimpse_id, viewer_id);

ALTER TABLE glimpses ENABLE ROW LEVEL SECURITY;
ALTER TABLE glimpse_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "glimpses_select" ON glimpses;
DROP POLICY IF EXISTS "glimpses_insert" ON glimpses;
DROP POLICY IF EXISTS "glimpses_update" ON glimpses;
DROP POLICY IF EXISTS "glimpses_delete" ON glimpses;

CREATE POLICY "glimpses_select" ON glimpses FOR SELECT USING (true);
CREATE POLICY "glimpses_insert" ON glimpses FOR INSERT WITH CHECK (true);
CREATE POLICY "glimpses_update" ON glimpses FOR UPDATE USING (true);
CREATE POLICY "glimpses_delete" ON glimpses FOR DELETE USING (true);

DROP POLICY IF EXISTS "glimpse_views_select" ON glimpse_views;
DROP POLICY IF EXISTS "glimpse_views_insert" ON glimpse_views;
DROP POLICY IF EXISTS "glimpse_views_update" ON glimpse_views;
DROP POLICY IF EXISTS "glimpse_views_delete" ON glimpse_views;

CREATE POLICY "glimpse_views_select" ON glimpse_views FOR SELECT USING (true);
CREATE POLICY "glimpse_views_insert" ON glimpse_views FOR INSERT WITH CHECK (true);
CREATE POLICY "glimpse_views_update" ON glimpse_views FOR UPDATE USING (true);
CREATE POLICY "glimpse_views_delete" ON glimpse_views FOR DELETE USING (true);

-- ── Confusions (Per-exam doubt & reply threads) ─────────────────────────────

-- Posts: one doubt per entry, scoped to an exam
CREATE TABLE IF NOT EXISTS confusion_posts (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  text TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  helpful INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS confusion_posts_exam_idx ON confusion_posts (exam_id, created_at DESC);
CREATE INDEX IF NOT EXISTS confusion_posts_author_idx ON confusion_posts (author_id);

-- Replies: threaded under a post
CREATE TABLE IF NOT EXISTS confusion_replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES confusion_posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_avatar TEXT,
  text TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  helpful INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS confusion_replies_post_idx ON confusion_replies (post_id, created_at ASC);

-- Add author_avatar column if created prior
ALTER TABLE confusion_posts ADD COLUMN IF NOT EXISTS author_avatar TEXT;
ALTER TABLE confusion_replies ADD COLUMN IF NOT EXISTS author_avatar TEXT;

ALTER TABLE confusion_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE confusion_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "confusion_posts_select" ON confusion_posts;
DROP POLICY IF EXISTS "confusion_posts_insert" ON confusion_posts;
DROP POLICY IF EXISTS "confusion_posts_update" ON confusion_posts;
DROP POLICY IF EXISTS "confusion_posts_delete" ON confusion_posts;
CREATE POLICY "confusion_posts_select" ON confusion_posts FOR SELECT USING (true);
CREATE POLICY "confusion_posts_insert" ON confusion_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "confusion_posts_update" ON confusion_posts FOR UPDATE USING (true);
CREATE POLICY "confusion_posts_delete" ON confusion_posts FOR DELETE USING (true);

DROP POLICY IF EXISTS "confusion_replies_select" ON confusion_replies;
DROP POLICY IF EXISTS "confusion_replies_insert" ON confusion_replies;
DROP POLICY IF EXISTS "confusion_replies_update" ON confusion_replies;
DROP POLICY IF EXISTS "confusion_replies_delete" ON confusion_replies;
CREATE POLICY "confusion_replies_select" ON confusion_replies FOR SELECT USING (true);
CREATE POLICY "confusion_replies_insert" ON confusion_replies FOR INSERT WITH CHECK (true);
CREATE POLICY "confusion_replies_update" ON confusion_replies FOR UPDATE USING (true);
CREATE POLICY "confusion_replies_delete" ON confusion_replies FOR DELETE USING (true);

-- Realtime for confusion tables
-- ALTER PUBLICATION supabase_realtime ADD TABLE confusion_posts;
-- ALTER PUBLICATION supabase_realtime ADD TABLE confusion_replies;

-- ── Per-user Activity Notifications ─────────────────────────────────────────
-- Stores targeted notifications for each user:
--   type = 'suggestion'        → someone added a suggestion (all users except actor)
--   type = 'confusion_post'    → someone posted a confusion (all users except actor)
--   type = 'confusion_reply'   → someone replied to a confusion (only the post author)

CREATE TABLE IF NOT EXISTS user_notifications (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL,        -- recipient student id
  type         TEXT NOT NULL,        -- 'suggestion' | 'confusion_post' | 'confusion_reply'
  title        TEXT NOT NULL,        -- display title
  body         TEXT,                 -- optional extra body text
  exam_id      TEXT,                 -- for deep-link ?e=
  exam_name    TEXT,
  ref_id       TEXT,                 -- suggestion id / post id
  action_url   TEXT,                 -- full deep-link URL e.g. /?tab=calendar&e=...&s=...
  sender_id    TEXT,
  sender_name  TEXT,
  sender_photo TEXT,
  read         BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_notifications_user_idx ON user_notifications (user_id, created_at DESC);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_notifs_select" ON user_notifications;
DROP POLICY IF EXISTS "user_notifs_insert" ON user_notifications;
DROP POLICY IF EXISTS "user_notifs_delete" ON user_notifications;

-- Each user reads only their own notifications
CREATE POLICY "user_notifs_select" ON user_notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Any logged-in user can send a notification to another user
CREATE POLICY "user_notifs_insert" ON user_notifications
  FOR INSERT WITH CHECK (true);

-- Users can update read status on notifications
CREATE POLICY "user_notifs_update" ON user_notifications
  FOR UPDATE USING (true);

-- User can only delete their own notifications (dismiss)
-- OR delete any notification that references a piece of content they deleted (cleanup)
CREATE POLICY "user_notifs_delete" ON user_notifications
  FOR DELETE USING (true);

-- Enable realtime so the notification feed updates live
ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;

-- ── RPC: delete notifications by ref_id (content cleanup) ───────────────────
-- Called when a user deletes a suggestion or confusion post so that
-- all related notifications (across all recipients) are also cleaned up.
-- SECURITY DEFINER bypasses RLS so it can delete other users' rows.
CREATE OR REPLACE FUNCTION delete_notifications_by_ref(p_ref_id TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM user_notifications WHERE ref_id = p_ref_id;
$$;
