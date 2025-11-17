-- tokensテーブルの存在確認と構造確認用SQL
-- SupabaseのSQL Editorで実行してください

-- 1. テーブルの存在確認
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'tokens'
) AS table_exists;

-- 2. テーブル構造の確認
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tokens'
ORDER BY ordinal_position;

-- 3. インデックスの確認
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'tokens';

-- 4. テストデータの挿入（動作確認用）
-- INSERT INTO tokens (token, user_id, expires_at) 
-- VALUES ('test_token_123', 'test_user_123', NOW() + INTERVAL '1 day')
-- ON CONFLICT (token) DO NOTHING;

-- 5. テストデータの取得（動作確認用）
-- SELECT * FROM tokens WHERE token = 'test_token_123';

-- 6. テストデータの削除（動作確認後）
-- DELETE FROM tokens WHERE token = 'test_token_123';

