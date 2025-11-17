-- articlesテーブルにform_versionカラムを追加するSQL（オプション）
-- SupabaseのSQL Editorで実行してください
-- このカラムは必須ではありませんが、フォームバージョンを追跡したい場合に使用します

-- カラムの追加
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS form_version TEXT DEFAULT 'pen-effect-web';

-- 既存のレコードにデフォルト値を設定（オプション）
UPDATE articles
SET form_version = 'pen-effect-web'
WHERE form_version IS NULL;

