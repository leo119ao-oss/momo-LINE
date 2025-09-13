-- Add notification and engagement preferences to participants table
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS notify_cron_pref TEXT DEFAULT 'daily_9_jst',
  ADD COLUMN IF NOT EXISTS engagement_level TEXT DEFAULT 'standard';
