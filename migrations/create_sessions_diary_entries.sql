-- セッション管理テーブル
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_interaction_at timestamptz not null default now()
);

-- 日記エントリーテーブル
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  date date not null,
  emotion text,             -- 'smile','neutral','tired','anger','sad','think' など
  summary text,             -- 2〜3行の整理
  insight text,             -- さりげない一言（出ない時はnull）
  visibility text not null default 'private', -- 'private' 固定でOK
  created_at timestamptz not null default now()
);

-- participantsテーブルに保存モード列を追加
alter table public.participants
add column if not exists consent_mode text not null default 'ephemeral'; -- 'ephemeral' | 'save'

-- インデックス追加
create index if not exists idx_sessions_participant_id on public.sessions(participant_id);
create index if not exists idx_sessions_started_at on public.sessions(started_at);
create index if not exists idx_diary_entries_participant_id on public.diary_entries(participant_id);
create index if not exists idx_diary_entries_date on public.diary_entries(date);

-- RLS設定
alter table public.sessions enable row level security;
alter table public.diary_entries enable row level security;

-- ポリシー設定（サービスロールは全アクセス可能）
create policy "Service role can do everything on sessions" on public.sessions
  for all using (auth.role() = 'service_role');

create policy "Service role can do everything on diary_entries" on public.diary_entries
  for all using (auth.role() = 'service_role');
