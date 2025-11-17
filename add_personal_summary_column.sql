-- participantsテーブルにpersonal_summaryカラムを追加するSQL
-- SupabaseのSQL Editorで実行してください

ALTER TABLE participants
ADD COLUMN IF NOT EXISTS personal_summary TEXT;

-- カラムが追加されたことを確認
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'participants'
  AND column_name = 'personal_summary';

