-- 緊急セットアップ用SQL
-- Supabaseダッシュボードで実行してください

-- 1. quiz_logsテーブルの作成
CREATE TABLE IF NOT EXISTS quiz_logs(
  id BIGSERIAL PRIMARY KEY,
  participant_id UUID REFERENCES participants(id),
  quiz_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('sent', 'tap_choice', 'open')),
  choice_index INTEGER, -- tap_choiceの場合の選択肢インデックス (0, 1, 2)
  article_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. インデックス作成
CREATE INDEX IF NOT EXISTS idx_quiz_logs_participant_id ON quiz_logs(participant_id);
CREATE INDEX IF NOT EXISTS idx_quiz_logs_quiz_id ON quiz_logs(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_logs_action ON quiz_logs(action);
CREATE INDEX IF NOT EXISTS idx_quiz_logs_created_at ON quiz_logs(created_at);

-- 3. quiz_masterテーブルの作成
CREATE TABLE IF NOT EXISTS quiz_master(
  id BIGSERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  choices JSONB NOT NULL, -- ["選択肢1", "選択肢2", "選択肢3"]
  correct_index INTEGER NOT NULL, -- 正解のインデックス (0, 1, 2)
  article_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. インデックス作成
CREATE INDEX IF NOT EXISTS idx_quiz_master_created_at ON quiz_master(created_at);

-- 5. テスト用のフォールバッククイズを事前作成
INSERT INTO quiz_master (question, choices, correct_index, article_url) VALUES 
('朝の時間を有効活用するコツはどれでしょうか？', 
 '["前夜に準備を済ませる", "朝一番でメールチェック", "家族全員で朝食を作る"]', 
 0, 
 'https://www.okaasan.net/sample-article')
ON CONFLICT DO NOTHING;
