-- Enable Row Level Security (RLS) for production security
-- 本番環境でのセキュリティ強化のため、RLSを有効化
-- ポリシーは運用方式決定後に追加予定

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
