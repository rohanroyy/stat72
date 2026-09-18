-- ─────────────────────────────────────────────────────────────────────────────
-- Class Ratings Migration
-- Run this in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the ratings table
CREATE TABLE IF NOT EXISTS class_ratings (
  id            TEXT PRIMARY KEY,         -- "rating_{student_id}_{subject}_{date}"
  student_id    TEXT NOT NULL,            -- references students(id)
  subject       TEXT NOT NULL,            -- e.g. "H 401"
  teacher       TEXT NOT NULL,            -- teacher initials e.g. "BH"
  date          TEXT NOT NULL,            -- "YYYY-MM-DD"
  rating        INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Unique constraint: one rating per student per subject per day
ALTER TABLE class_ratings
  DROP CONSTRAINT IF EXISTS class_ratings_student_subject_date_unique;

ALTER TABLE class_ratings
  ADD CONSTRAINT class_ratings_student_subject_date_unique
  UNIQUE (student_id, subject, date);

-- 3. Enable Row Level Security
ALTER TABLE class_ratings ENABLE ROW LEVEL SECURITY;

-- 4. Students can insert their own ratings
DROP POLICY IF EXISTS "Students can insert own ratings" ON class_ratings;
CREATE POLICY "Students can insert own ratings"
  ON class_ratings FOR INSERT
  WITH CHECK (auth.uid()::text = student_id);

-- 5. Students can update their own ratings
DROP POLICY IF EXISTS "Students can update own ratings" ON class_ratings;
CREATE POLICY "Students can update own ratings"
  ON class_ratings FOR UPDATE
  USING (auth.uid()::text = student_id);

-- 6. Anyone authenticated can read all ratings (needed for aggregation panel)
DROP POLICY IF EXISTS "Anyone can read ratings" ON class_ratings;
CREATE POLICY "Anyone can read ratings"
  ON class_ratings FOR SELECT
  USING (true);
