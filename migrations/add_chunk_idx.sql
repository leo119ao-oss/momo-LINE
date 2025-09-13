-- Add chunk_idx column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunk_idx INT DEFAULT 0;

-- Create unique index for source_url and chunk_idx combination
CREATE UNIQUE INDEX IF NOT EXISTS documents_url_chunk_idx ON documents (source_url, chunk_idx);
