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
CREATE POLICY "students_update_own" ON students FOR UPDATE USING (auth.uid() = id);

-- Migration: add profile_picture column if it does not already exist
-- Run this if you already created the students table before this update:
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_picture TEXT DEFAULT NULL;

