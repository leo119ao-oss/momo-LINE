-- quiz_logsテーブルの作成
-- 朝の1分クイズ機能用のログテーブル

create table if not exists quiz_logs(
  id bigserial primary key,
  participant_id uuid references participants(id),
  quiz_id integer not null,
  action text not null check (action in ('sent', 'tap_choice', 'open')),
  choice_index integer, -- tap_choiceの場合の選択肢インデックス (0, 1, 2)
  article_url text,
  created_at timestamptz default now()
);

-- インデックス作成
create index if not exists idx_quiz_logs_participant_id on quiz_logs(participant_id);
create index if not exists idx_quiz_logs_quiz_id on quiz_logs(quiz_id);
create index if not exists idx_quiz_logs_action on quiz_logs(action);
create index if not exists idx_quiz_logs_created_at on quiz_logs(created_at);

-- クイズマスターテーブル（必要に応じて）
create table if not exists quiz_master(
  id bigserial primary key,
  question text not null,
  choices jsonb not null, -- ["選択肢1", "選択肢2", "選択肢3"]
  correct_index integer not null, -- 正解のインデックス (0, 1, 2)
  article_url text not null,
  created_at timestamptz default now()
);

-- インデックス作成
create index if not exists idx_quiz_master_created_at on quiz_master(created_at);
