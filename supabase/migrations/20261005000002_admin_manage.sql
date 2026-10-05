-- Yönetici ekranı, 2. adım: üye ayrıntısı, yasaklama, hesap silme ve çıktı (export) sayacı.
--
-- * export_events: üye video ya da görsel çıktısı aldığında tarayıcı bir satır yazar (yalnızca kendi adına).
--   Sayım bu göçten sonrasını kapsar; öncesi bilinmez.
-- * admin_member_detail: bir üyenin hesabı, planı, depolaması, proje ve çıktı sayıları, son projelerinin adları.
--   Proje içeriği verilmez.
-- * admin_set_banned: auth.users.banned_until yazar ve açık oturumları kapatır. Girişi ve oturum yenilemeyi
--   engeller; elindeki erişim anahtarı süresi dolana kadar (en çok 1 saat) geçerli kalır.
-- * admin_delete_user: auth.users satırını siler; profil, proje, klasör, dosya kaydı ve çıktı kayıtları
--   "on delete cascade" ile gider. Storage'daki dosyalar SQL ile silinemez (Supabase engeller): arayüz
--   önce onları Storage API ile siler, bunun için yöneticiye assets kovasında okuma/silme izni verilir.
-- * Yönetici kendini ya da başka bir yöneticiyi yasaklayamaz/silemez.

-- Çıktı kayıtları ---------------------------------------------------------------------------------------

create table public.export_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('video', 'image')),
  format text not null default '' check (char_length(format) <= 12),
  width integer not null check (width between 1 and 16384),
  height integer not null check (height between 1 and 16384),
  fps real check (fps is null or fps between 1 and 240),
  -- saniye; görselde boş
  duration real check (duration is null or duration between 0 and 36000),
  created_at timestamptz not null default now()
);
create index export_events_user_idx on public.export_events (user_id, created_at desc);

alter table public.export_events enable row level security;

create policy "export_events: kendi adına ekle" on public.export_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Liste: yasaklı bilgisi eklendi (dönüş tipi değiştiği için işlev yeniden kurulur) -------------------------

drop function public.admin_members(integer);

create function public.admin_members(p_limit integer default 200)
returns table (user_id uuid, email text, provider text, plan text, created_at timestamptz, last_sign_in_at timestamptz, is_new boolean, banned boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  seen timestamptz;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  select p.members_seen_at into seen from public.profiles p where p.user_id = auth.uid();
  return query
    select u.id, u.email::text, coalesce(u.raw_app_meta_data ->> 'provider', 'email'), coalesce(p.plan, 'free'),
           u.created_at, u.last_sign_in_at, (seen is null or u.created_at > seen) and u.id <> auth.uid(),
           coalesce(u.banned_until > now(), false)
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    order by u.created_at desc
    limit least(greatest(p_limit, 1), 1000);
end;
$$;

-- Ayrıntı -----------------------------------------------------------------------------------------------

create function public.admin_member_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  select jsonb_build_object(
    'user_id', u.id,
    'email', u.email,
    'name', coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
    'providers', coalesce(u.raw_app_meta_data -> 'providers', jsonb_build_array(coalesce(u.raw_app_meta_data ->> 'provider', 'email'))),
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'email_confirmed', u.email_confirmed_at is not null,
    'banned', coalesce(u.banned_until > now(), false),
    'is_admin', coalesce(p.is_admin, false),
    'is_self', u.id = auth.uid(),
    'plan', coalesce(p.plan, 'free'),
    'storage_used', public.storage_used(u.id),
    'storage_quota', public.storage_quota(u.id),
    'files', (select count(*) from public.assets a where a.user_id = u.id),
    'projects', (
      select jsonb_build_object(
        'videos', count(*) filter (where pr.mode is null and not pr.is_template),
        'designs', count(*) filter (where pr.mode = 'design' and not pr.is_template),
        'templates', count(*) filter (where pr.is_template),
        'shared', count(*) filter (where pr.share_id is not null),
        'by_claude', count(*) filter (where pr.source = 'mcp'),
        'last_edit', max(pr.updated_at))
      from public.projects pr where pr.user_id = u.id),
    'exports', (
      select jsonb_build_object(
        'videos', count(*) filter (where e.kind = 'video'),
        'images', count(*) filter (where e.kind = 'image'),
        'last', max(e.created_at))
      from public.export_events e where e.user_id = u.id),
    'recent_projects', coalesce((
      select jsonb_agg(jsonb_build_object('name', r.name, 'design', r.mode = 'design', 'template', r.is_template, 'by_claude', r.source = 'mcp', 'updated_at', r.updated_at) order by r.updated_at desc)
      from (select pr.name, pr.mode, pr.is_template, pr.source, pr.updated_at from public.projects pr
            where pr.user_id = u.id order by pr.updated_at desc limit 8) r), '[]'::jsonb),
    'recent_exports', coalesce((
      select jsonb_agg(jsonb_build_object('kind', r.kind, 'format', r.format, 'width', r.width, 'height', r.height, 'fps', r.fps, 'created_at', r.created_at) order by r.created_at desc)
      from (select e.kind, e.format, e.width, e.height, e.fps, e.created_at from public.export_events e
            where e.user_id = u.id order by e.created_at desc limit 5) r), '[]'::jsonb)
  ) into result
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = p_user;
  if result is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  return result;
end;
$$;

-- Yasaklama ve silme ------------------------------------------------------------------------------------

-- Yönetici mi, hedef var mı, hedef kendisi ya da başka bir yönetici mi: değilse hata.
create function public.admin_check_target(p_user uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'cannot_target_self' using errcode = 'P0001'; end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.profiles p where p.user_id = p_user and p.is_admin) then
    raise exception 'cannot_target_admin' using errcode = 'P0001';
  end if;
end;
$$;

create function public.admin_set_banned(p_user uuid, p_banned boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_check_target(p_user);
  update auth.users set banned_until = case when p_banned then now() + interval '100 years' end where id = p_user;
  if p_banned then delete from auth.sessions where user_id = p_user; end if;
end;
$$;

create function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_check_target(p_user);
  delete from auth.users where id = p_user;
end;
$$;

-- Silinecek üyenin dosyaları: yönetici Storage API ile listeleyip silebilsin.
create policy "assets dosyaları: yönetici okur" on storage.objects
  for select to authenticated
  using (bucket_id = 'assets' and (select public.is_admin()));

create policy "assets dosyaları: yönetici siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'assets' and (select public.is_admin()));

revoke execute on function public.admin_members(integer) from public, anon;
revoke execute on function public.admin_member_detail(uuid) from public, anon;
revoke execute on function public.admin_check_target(uuid) from public, anon, authenticated;
revoke execute on function public.admin_set_banned(uuid, boolean) from public, anon;
revoke execute on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_members(integer) to authenticated;
grant execute on function public.admin_member_detail(uuid) to authenticated;
grant execute on function public.admin_set_banned(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
