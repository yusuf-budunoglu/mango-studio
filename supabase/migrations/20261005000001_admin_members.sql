-- Yönetici ekranı: üye listesi ve yeni üye bildirimi (sol menüdeki sayaç).
--
-- * auth.users istemciden okunamaz; liste yalnızca yöneticiye, security definer işlevlerle verilir.
--   Yönetici olmayan çağıran 'not_admin' hatası alır.
-- * profiles.members_seen_at: yöneticinin Üyeler sayfasını en son açtığı an. Ondan sonra üye olanlar
--   "yeni" sayılır (hiç açmadıysa hepsi yeni). Sunucuda tutulur: sayaç her cihazda aynıdır.

alter table public.profiles add column members_seen_at timestamptz;

create function public.admin_members(p_limit integer default 200)
returns table (user_id uuid, email text, provider text, plan text, created_at timestamptz, last_sign_in_at timestamptz, is_new boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  seen timestamptz;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  select p.members_seen_at into seen from public.profiles p where p.user_id = auth.uid();
  return query
    select u.id, u.email::text, coalesce(u.raw_app_meta_data ->> 'provider', 'email'), coalesce(p.plan, 'free'),
           u.created_at, u.last_sign_in_at, (seen is null or u.created_at > seen) and u.id <> auth.uid()
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    order by u.created_at desc
    limit least(greatest(p_limit, 1), 1000);
end;
$$;

-- Sayaç için: toplam üye ve yöneticinin henüz görmediği yeni üye sayısı.
create function public.admin_member_counts()
returns table (total bigint, unseen bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  seen timestamptz;
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  select p.members_seen_at into seen from public.profiles p where p.user_id = auth.uid();
  return query
    select count(*), count(*) filter (where (seen is null or u.created_at > seen) and u.id <> auth.uid())
    from auth.users u;
end;
$$;

create function public.admin_mark_members_seen() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin' using errcode = '42501'; end if;
  update public.profiles set members_seen_at = now() where user_id = auth.uid();
end;
$$;

revoke execute on function public.admin_members(integer) from public, anon;
revoke execute on function public.admin_member_counts() from public, anon;
revoke execute on function public.admin_mark_members_seen() from public, anon;
grant execute on function public.admin_members(integer) to authenticated;
grant execute on function public.admin_member_counts() to authenticated;
grant execute on function public.admin_mark_members_seen() to authenticated;
