-- 研究開始パック用DBスキーマ

-- 参加者と割付
create table if not exists participants(
  id uuid primary key default gen_random_uuid(),
  display_name text,
  contact text,
  cohort text, -- community | general
  condition text, -- minimal | extended
  consented_at timestamptz,
  created_at timestamptz default now()
);

-- 日次/週次/サーベイ
create table if not exists daily_checkins(
  id bigserial primary key,
  user_id uuid references participants(id),
  ts timestamptz default now(),
  mood int, -- 0-10
  load int, -- 0-10
  efficacy int, -- 0-10
  choice text, memo text,
  completed boolean default true
);

create table if not exists weekly_summaries(
  id bigserial primary key,
  user_id uuid references participants(id),
  week_start date,
  did text, relied text, next_step text,
  shared_card boolean default false,
  share_link text,
  created_at timestamptz default now()
);

create table if not exists surveys(
  id bigserial primary key,
  user_id uuid references participants(id),
  phase text, -- pre | mid | post
  answers jsonb,
  minutes int,
  created_at timestamptz default now()
);

-- 研究ログ
create table if not exists rag_events(
  id bigserial primary key,
  rev text,
  intent text,
  q text,
  top_k int,
  min_sim float,
  raw_count int,
  kept_count int,
  low_conf_fallback boolean,
  created_at timestamptz default now()
);

-- 事業シグナル
create table if not exists cta_clicks(
  id bigserial primary key,
  user_id uuid references participants(id),
  kind text, -- family_auto, photobook, grandparents, b2b_report
  shown_at timestamptz default now(),
  clicked_at timestamptz
);

create table if not exists waitlist(
  id bigserial primary key,
  user_id uuid references participants(id),
  kind text, 
  contact text, 
  note text,
  created_at timestamptz default now()
);

create table if not exists family_feedback(
  id bigserial primary key,
  card_slug text,
  rater text, -- partner | gp | other
  score int, -- 1-5
  comment text,
  created_at timestamptz default now()
);

-- WPメタキャッシュ（既存ならスキップ）
create table if not exists wp_meta_cache(
  url text primary key,
  title text, 
  author text,
  updated_at timestamptz default now()
);

-- インデックス作成
create index if not exists idx_daily_checkins_user_id on daily_checkins(user_id);
create index if not exists idx_weekly_summaries_user_id on weekly_summaries(user_id);
create index if not exists idx_surveys_user_id on surveys(user_id);
create index if not exists idx_rag_events_created_at on rag_events(created_at);
create index if not exists idx_cta_clicks_user_id on cta_clicks(user_id);
create index if not exists idx_waitlist_user_id on waitlist(user_id);
create index if not exists idx_family_feedback_card_slug on family_feedback(card_slug);
