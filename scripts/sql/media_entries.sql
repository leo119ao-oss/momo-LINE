create table if not exists media_entries(
  id bigserial primary key,
  user_id uuid references participants(id),
  storage_path text,
  public_url text,
  ask_stage text,                 -- suggest | confirm | finalized
  suggested_caption jsonb,        -- ["候補1","候補2","候補3"]
  title text,                     -- 確定キャプション
  extra_note text,
  page_slug text unique,
  created_at timestamptz default now()
);
