-- Add metadata columns to documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS author_name TEXT;
