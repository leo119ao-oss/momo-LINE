-- Add profile_summary column to participants table
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS profile_summary TEXT;
