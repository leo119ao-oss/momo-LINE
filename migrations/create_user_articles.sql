-- ユーザー記事テーブルを作成
CREATE TABLE IF NOT EXISTS user_articles (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_articles TEXT[], -- 元記事のURL配列
  search_query TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_user_articles_user_id ON user_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_articles_status ON user_articles(status);
CREATE INDEX IF NOT EXISTS idx_user_articles_created_at ON user_articles(created_at);

-- 検索ログテーブルを作成
CREATE TABLE IF NOT EXISTS search_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  search_type TEXT DEFAULT 'article_search',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);
