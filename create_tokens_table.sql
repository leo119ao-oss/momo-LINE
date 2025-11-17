-- tokensテーブルを作成するSQL
-- SupabaseのSQL Editorで実行してください

-- tokensテーブルの作成
CREATE TABLE IF NOT EXISTS tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックスの作成（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_expires_at ON tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);

-- 期限切れトークンの自動削除用の関数（オプション）
-- 定期的に実行するか、cronジョブで実行
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

