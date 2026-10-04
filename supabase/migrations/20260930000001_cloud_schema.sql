-- Mango Studio bulut şeması: projeler, klasörler, dosyalar, API anahtarları.
-- Her tablo satır düzeyinde güvenlikle (RLS) korunur: kullanıcı yalnızca kendi satırlarını görür.

create table public.folders (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.projects (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 200),
  duration real not null default 0,
  width integer,
  height integer,
  -- null = video, 'design' = tek karelik tasarım
  mode text check (mode is null or mode = 'design'),
  folder_id text,
  -- küçük önizleme (JPEG data URL)
  thumbnail text,
  -- proje formatı (src/engine/types.ts), sürümüyle birlikte
  data jsonb not null,
  -- projeyi kim oluşturdu: editör ya da Claude Code (MCP)
  source text not null default 'editor' check (source in ('editor', 'mcp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint projects_data_size check (pg_column_size(data) < 8000000)
);
create index projects_user_updated_idx on public.projects (user_id, updated_at desc);

-- Yüklenen görsel, ses, video, SVG ve font dosyalarının bilgisi; dosyanın kendisi Storage'da.
create table public.assets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null check (char_length(name) between 1 and 300),
  kind text not null check (kind in ('image', 'audio', 'video', 'svg', 'font')),
  type text not null default '',
  size bigint not null default 0,
  duration real,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Claude Code bağlantısı için kişisel anahtarlar. Yalnızca özeti (hash) saklanır.
create table public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_tokens_user_idx on public.api_tokens (user_id);

alter table public.folders enable row level security;
alter table public.projects enable row level security;
alter table public.assets enable row level security;
alter table public.api_tokens enable row level security;

create policy "folders: kendi satırların" on public.folders
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "projects: kendi satırların" on public.projects
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "assets: kendi satırların" on public.assets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "api_tokens: kendi satırların" on public.api_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Dosya deposu: özel kova, yollar <kullanıcı id>/<dosya id> biçiminde.
insert into storage.buckets (id, name, public, file_size_limit)
values ('assets', 'assets', false, 52428800)
on conflict (id) do nothing;

create policy "assets dosyaları: oku" on storage.objects
  for select to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "assets dosyaları: yükle" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "assets dosyaları: güncelle" on storage.objects
  for update to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "assets dosyaları: sil" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
