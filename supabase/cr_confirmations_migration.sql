-- ============================================================
-- CR Class Confirmations Table
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Create the table
CREATE TABLE IF NOT EXISTS cr_class_confirmations (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  subject TEXT NOT NULL,
  slot_key TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  class_count INTEGER NOT NULL DEFAULT 1 CHECK (class_count IN (1, 2)),
  confirmed_by TEXT NOT NULL,
  confirmed_by_name TEXT,
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  is_confirmed BOOLEAN DEFAULT TRUE,
  UNIQUE(date, subject, slot_key)
);

-- Enable Row Level Security
ALTER TABLE cr_class_confirmations ENABLE ROW LEVEL SECURITY;

-- Policy: anyone (including unauthenticated / anon) can read confirmations
-- This allows the Explore page class count board to work without login
CREATE POLICY "Anyone can read confirmations"
  ON cr_class_confirmations
  FOR SELECT
  USING (TRUE);

-- Policy: authenticated users (CRs) can insert new confirmations
CREATE POLICY "Authenticated users can insert confirmations"
  ON cr_class_confirmations
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: authenticated users can update confirmations (e.g. change class_count)
CREATE POLICY "Authenticated users can update confirmations"
  ON cr_class_confirmations
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Policy: authenticated users can delete confirmations (undo/unconfirm)
CREATE POLICY "Authenticated users can delete confirmations"
  ON cr_class_confirmations
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Enable realtime for this table (for live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE cr_class_confirmations;

-- Verify table created
SELECT 'cr_class_confirmations table created successfully!' AS status;
