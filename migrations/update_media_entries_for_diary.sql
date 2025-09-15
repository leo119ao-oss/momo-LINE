-- media_entries テーブルを絵日記機能用に拡張
ALTER TABLE media_entries
  ADD COLUMN IF NOT EXISTS ask_stage INT DEFAULT 0,            -- 0:初期, 1:候補提示済み, 2:メモ待ち, 3:完成
  ADD COLUMN IF NOT EXISTS suggested_caption TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS extra_note TEXT,
  ADD COLUMN IF NOT EXISTS page_slug TEXT UNIQUE;

-- slug 検索用インデックス
CREATE INDEX IF NOT EXISTS idx_media_entries_slug ON media_entries(page_slug);
