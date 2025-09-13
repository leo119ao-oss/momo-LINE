-- Create line_push_errors table for logging push message errors
CREATE TABLE IF NOT EXISTS line_push_errors (
  id BIGSERIAL PRIMARY KEY,
  line_user_id TEXT,
  payload JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
