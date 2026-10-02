-- Run once in Supabase SQL editor.
create table if not exists site (
  key text primary key,
  value jsonb not null
);

create table if not exists projects (
  slug text primary key,
  title_ko text, title_en text,
  summary_ko text, summary_en text,
  tags text[] default '{}',
  url text, homepage text, image text,
  stars int default 0,
  pushed_at timestamptz,
  featured boolean default false,
  sort int default 100
);

-- Public read; writes only via service role (bypasses RLS).
alter table site enable row level security;
alter table projects enable row level security;
create policy "public read site" on site for select using (true);
create policy "public read projects" on projects for select using (true);
