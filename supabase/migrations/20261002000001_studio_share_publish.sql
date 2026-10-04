-- Studio bölümleri, paylaşım bağlantısı, depolama kotası ve yalnızca yöneticinin yayınladığı genel şablonlar.
--
-- * profiles: plan (kota buradan okunur) ve yönetici bayrağı. Kullanıcı kendi satırını yalnızca okur;
--   plan ve yönetici yetkisini yalnızca sunucu (service_role / SQL editörü) değiştirir.
-- * projects: is_template (kullanıcının kendi şablonları), share_id (bağlantıyla paylaşım), asset_ids
--   (projede geçen dosyalar; paylaşılan projenin dosyalarını açmak için sunucuda hesaplanır).
-- * Depolama kotası: assets satırı eklenirken toplam boyut planın kotasını aşarsa reddedilir; dosya
--   Storage'a ancak kotadan geçmiş bir assets satırı varsa yüklenebilir.
-- * public_templates: sitenin Şablonlar sayfasındaki genel şablonlar; herkes okur, yalnızca yönetici yazar.

-- Profil ----------------------------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'unlimited')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: kendi satırını oku" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Yeni üyeye profil satırı; eski üyeler için de bir kez doldurulur.
create function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile();

insert into public.profiles (user_id) select id from auth.users on conflict do nothing;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where user_id = auth.uid()), false);
$$;

-- Depolama kotası ------------------------------------------------------------------------------------
-- Rakamlar src/billing/plans.ts `storageBytes` ile aynı olmalı (plans.test.ts kontrol eder).

create function public.storage_quota(uid uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select case coalesce((select plan from public.profiles where user_id = uid), 'free')
    when 'starter' then 5000000000::bigint
    when 'pro' then 20000000000::bigint
    when 'unlimited' then 100000000000::bigint
    else 500000000::bigint
  end;
$$;

create function public.storage_used(uid uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(size), 0)::bigint from public.assets where user_id = uid;
$$;

-- Studio'daki kullanım çubuğu için: kullanılan, kota ve plan.
create function public.storage_status() returns table (used bigint, quota bigint, plan text)
language sql stable security definer set search_path = '' as $$
  select public.storage_used(auth.uid()),
         public.storage_quota(auth.uid()),
         coalesce((select p.plan from public.profiles p where p.user_id = auth.uid()), 'free');
$$;

create function public.enforce_storage_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  previous bigint := 0;
begin
  -- upsert (aynı dosya yeniden yüklenince) INSERT olarak gelir: eski boyutu düş
  if tg_op = 'UPDATE' then previous := old.size;
  else previous := coalesce((select size from public.assets where user_id = new.user_id and id = new.id), 0);
  end if;
  if new.size < 0 then raise exception 'invalid_size'; end if;
  if public.storage_used(new.user_id) - previous + new.size > public.storage_quota(new.user_id) then
    raise exception 'storage_quota_exceeded' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger assets_storage_quota
  before insert or update of size on public.assets
  for each row execute function public.enforce_storage_quota();

-- Dosya ancak kotadan geçmiş bir assets satırı varsa yüklenir/değiştirilir.
drop policy "assets dosyaları: yükle" on storage.objects;
drop policy "assets dosyaları: güncelle" on storage.objects;

create policy "assets dosyaları: yükle" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.assets a where a.user_id = (select auth.uid()) and a.id = storage.filename(objects.name))
  );

create policy "assets dosyaları: güncelle" on storage.objects
  for update to authenticated
  using (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (
    bucket_id = 'assets'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.assets a where a.user_id = (select auth.uid()) and a.id = storage.filename(objects.name))
  );

-- Projeler: şablon, paylaşım, kullanılan dosyalar -------------------------------------------------------

alter table public.projects
  add column is_template boolean not null default false,
  add column share_id text unique check (share_id is null or share_id ~ '^[A-Za-z0-9_-]{16,64}$'),
  add column shared_at timestamptz,
  add column asset_ids text[] not null default '{}';

-- Projede geçen tüm "asset:<id>" referansları (hangi alanda olursa olsun).
create function public.project_asset_ids(data jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct substr(v #>> '{}', 7)), '{}')
  from jsonb_path_query(data, 'strict $.**') v
  where jsonb_typeof(v) = 'string' and v #>> '{}' like 'asset:%';
$$;

create function public.set_project_asset_ids() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.asset_ids := public.project_asset_ids(new.data);
  return new;
end;
$$;

create trigger projects_asset_ids
  before insert or update on public.projects
  for each row execute function public.set_project_asset_ids();

update public.projects set asset_ids = public.project_asset_ids(data);

create index projects_share_idx on public.projects (share_id) where share_id is not null;

-- Paylaşılan proje: bağlantıyı bilen herkes (üye olmasa da) okur. Tablo üzerinden listelenemez.
create function public.get_shared_project(p_share_id text)
returns table (owner_id uuid, name text, data jsonb, width integer, height integer, mode text, is_template boolean, thumbnail text, assets jsonb)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.name, p.data, p.width, p.height, p.mode, p.is_template, p.thumbnail,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'kind', a.kind, 'duration', a.duration))
      from public.assets a where a.user_id = p.user_id and a.id = any (p.asset_ids)
    ), '[]'::jsonb)
  from public.projects p
  where p.share_id = p_share_id and p_share_id is not null;
$$;

grant execute on function public.get_shared_project(text) to anon, authenticated;

-- Paylaşılan projede geçen dosya mı (Storage okuma kuralı için; RLS'yi atlayarak bakar).
create function public.is_shared_asset(owner text, asset text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.share_id is not null and p.user_id::text = owner and asset = any (p.asset_ids)
  );
$$;

create policy "assets dosyaları: paylaşılanı oku" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'assets' and public.is_shared_asset((storage.foldername(name))[1], storage.filename(name)));

-- Genel şablonlar (yalnızca yönetici yayınlar) ---------------------------------------------------------

create table public.public_templates (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  tags text[] not null default '{}',
  width integer not null,
  height integer not null,
  duration real not null,
  mode text check (mode is null or mode = 'design'),
  data jsonb not null,
  -- dosya bilgileri: [{id, name, kind, duration}]; dosyalar `templates/<şablon>/<dosya>` yolunda
  assets jsonb not null default '[]',
  -- herkese açık kapak görseli ve isteğe bağlı döngü videosu (templates kovasındaki yol)
  poster_path text,
  loop_path text,
  published_by uuid references auth.users (id) on delete set null default auth.uid(),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_templates_data_size check (pg_column_size(data) < 8000000)
);

alter table public.public_templates enable row level security;

create policy "public_templates: herkes okur" on public.public_templates
  for select to anon, authenticated using (true);

create policy "public_templates: yönetici ekler" on public.public_templates
  for insert to authenticated with check ((select public.is_admin()));

create policy "public_templates: yönetici değiştirir" on public.public_templates
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "public_templates: yönetici siler" on public.public_templates
  for delete to authenticated using ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit)
values ('templates', 'templates', true, 52428800)
on conflict (id) do nothing;

create policy "templates dosyaları: yönetici yükler" on storage.objects
  for insert to authenticated with check (bucket_id = 'templates' and (select public.is_admin()));

create policy "templates dosyaları: yönetici değiştirir" on storage.objects
  for update to authenticated using (bucket_id = 'templates' and (select public.is_admin()));

create policy "templates dosyaları: yönetici siler" on storage.objects
  for delete to authenticated using (bucket_id = 'templates' and (select public.is_admin()));

-- Yönetici yapmak için (SQL editöründe, bir kez):
--   update public.profiles set is_admin = true
--   where user_id = (select id from auth.users where email = '<e-posta>');
