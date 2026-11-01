-- Plan ayrıcalıkları: aylık çıktı sınırı, Claude ile kurulan proje sınırı ve marka kiti
--
-- Rakamlar ve hangi planda ne olduğu src/billing/plans.ts ile aynı olmalı (plans.test.ts denetler).
-- * Çıktı: ücretsiz planda ayda 5 çıktı (video + görsel birlikte), ücretli planlarda sınırsız. export_status üyenin
--   bu dönemdeki çıktı sayısını ve sınırını verir. Çıktı tarayıcıda üretildiği için sınır arayüzde uygulanır
--   (editör çıktıdan önce export_status'a bakar); yalnızca başarılı çıktı sayılır (export_events).
-- * Claude (MCP) projeleri: ücretsiz planda ayda 3 yeni proje, ücretli planlarda sınırsız. Sunucuda uygulanır:
--   projects'e `source = 'mcp'` satırı eklenirken tetikleyici sayar (mcp_usage; silinen proje sayacı düşürmez),
--   sınır dolmuşsa mcp_project_limit_reached. Var olan projeyi Claude ile düzenlemek sınıra girmez.
-- * Marka kiti: üye başına bir satır (brand_kits); yazmayı yalnızca Pro ve Unlimited planlar yapabilir (RLS),
--   plan düşse de kayıtlı kit okunur ve silinebilir.
-- Dönem her yerde ai_period_start: abonelikte abonelik günü, aboneliği olmayanda takvim ayı (UTC).

begin;

-- Çıktı sınırı ------------------------------------------------------------------------------------------

create function public.export_limit(p_plan text) returns integer
language sql immutable set search_path = '' as $$
  select case when p_plan in ('starter', 'pro', 'unlimited') then null::integer else 5 end;
$$;

create function public.export_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'used', (
      select count(*)::integer from public.export_events e
      where e.user_id = auth.uid() and e.created_at >= (public.ai_period_start(auth.uid())::timestamp at time zone 'utc')
    ),
    'limit', public.export_limit(coalesce((select p.plan from public.profiles p where p.user_id = auth.uid()), 'free')),
    'period_start', public.ai_period_start(auth.uid())
  );
$$;

-- Claude ile kurulan projeler ------------------------------------------------------------------------------

create table public.mcp_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  projects integer not null default 0,
  primary key (user_id, day)
);

alter table public.mcp_usage enable row level security;

create policy "mcp_usage: kendi satırlarını oku" on public.mcp_usage
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on table public.mcp_usage from anon;
revoke insert, update, delete, truncate, references, trigger on table public.mcp_usage from authenticated;

create function public.mcp_project_limit(p_plan text) returns integer
language sql immutable set search_path = '' as $$
  select case when p_plan in ('starter', 'pro', 'unlimited') then null::integer else 3 end;
$$;

create function public.enforce_mcp_project_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'utc')::date;
  v_limit integer;
  v_used integer;
begin
  if new.source is distinct from 'mcp' then
    return new;
  end if;
  v_limit := public.mcp_project_limit(coalesce((select p.plan from public.profiles p where p.user_id = new.user_id), 'free'));
  if v_limit is not null then
    select coalesce(sum(u.projects), 0)::integer into v_used
      from public.mcp_usage u where u.user_id = new.user_id and u.day >= public.ai_period_start(new.user_id);
    if v_used >= v_limit then
      raise exception 'mcp_project_limit_reached' using errcode = 'P0001';
    end if;
  end if;
  insert into public.mcp_usage as u (user_id, day, projects) values (new.user_id, today, 1)
    on conflict (user_id, day) do update set projects = u.projects + 1;
  return new;
end;
$$;

create trigger projects_mcp_limit
  before insert on public.projects
  for each row execute function public.enforce_mcp_project_limit();

-- Marka kiti -------------------------------------------------------------------------------------------------

create function public.can_use_brand_kit() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.plan from public.profiles p where p.user_id = auth.uid()), 'free') in ('pro', 'unlimited');
$$;

create table public.brand_kits (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- ad, site adresi, renkler, yazı tipi ve logo referansı (src/project/brandKit.ts `BrandKit`)
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint brand_kits_data_size check (pg_column_size(data) < 8000)
);

alter table public.brand_kits enable row level security;

create policy "brand_kits: kendi satırını oku" on public.brand_kits
  for select to authenticated using (user_id = (select auth.uid()));
create policy "brand_kits: planında varsa ekle" on public.brand_kits
  for insert to authenticated with check (user_id = (select auth.uid()) and public.can_use_brand_kit());
create policy "brand_kits: planında varsa güncelle" on public.brand_kits
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.can_use_brand_kit());
create policy "brand_kits: kendi satırını sil" on public.brand_kits
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on table public.brand_kits from anon;
revoke truncate, references, trigger on table public.brand_kits from authenticated;

-- Yetkiler ---------------------------------------------------------------------------------------------------

revoke execute on function public.export_limit(text) from public, anon, authenticated;
revoke execute on function public.mcp_project_limit(text) from public, anon, authenticated;
revoke execute on function public.enforce_mcp_project_limit() from public, anon, authenticated;
revoke execute on function public.export_status() from public, anon;
revoke execute on function public.can_use_brand_kit() from public, anon;
grant execute on function public.export_status() to authenticated;
grant execute on function public.can_use_brand_kit() to authenticated;

commit;
