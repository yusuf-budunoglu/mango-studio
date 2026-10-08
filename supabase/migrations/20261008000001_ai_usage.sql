-- Yapay zekâyla düzenleme: plan denetimi ve kredi sayacı
--
-- Editördeki sohbet satırı Worker'daki /api/ai/edit ucuna yazar; uç, üyenin kendi oturum anahtarıyla önce
-- ai_begin() (plan, aylık kredi ve günlük istek sınırı), bir şey değiştiren yanıttan sonra ai_spend() çağırır.
-- * ai_usage: üye + gün başına istek ve harcanan kredi. Üye kendi satırlarını yalnızca okur; yazmak yalnızca
--   aşağıdaki işlevlerle olur (işlevleri doğrudan çağıran üye ancak kendi sayacını artırabilir).
-- * Aylık kredi takvim ayına göre (UTC) sayılır: ödeme bağlanınca abonelik gününe çevrilmeli.
-- * Kredi rakamları sonraki göçte değişti (20261009000001_ai_message_limits.sql: starter 150, pro 500); güncel
--   rakamlar oradaki ai_credit_limit'te ve src/billing/plans.ts `aiCredits`'te.

begin;

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  requests integer not null default 0,
  credits integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

create policy "ai_usage: kendi satırlarını oku" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on table public.ai_usage from anon;
revoke insert, update, delete, truncate, references, trigger on table public.ai_usage from authenticated;

-- Planın aylık yapay zekâ kredisi: 0 = planda yok, null = sınırsız.
create function public.ai_credit_limit(p_plan text) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan
    when 'starter' then 300
    when 'pro' then 1000
    when 'unlimited' then null
    else 0
  end;
$$;

-- İstekten önce: plan ve sınırlar uygunsa günün istek sayacını artırır, kullanılan ve toplam krediyi döndürür.
-- Hatalar: ai_plan_required (planda kredi yok), ai_credits_exhausted (bu ayın kredisi bitti),
-- ai_rate_limited (günde 1000 istek; sınırsız planda ve bir şey değiştirmeyen isteklerde de geçerli).
create function public.ai_begin() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  v_plan text;
  v_limit integer;
  v_used integer;
  v_requests integer;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  select coalesce((select p.plan from public.profiles p where p.user_id = uid), 'free') into v_plan;
  v_limit := public.ai_credit_limit(v_plan);
  if v_limit = 0 then
    raise exception 'ai_plan_required' using errcode = 'P0001';
  end if;
  select coalesce(sum(u.credits), 0)::integer into v_used
    from public.ai_usage u where u.user_id = uid and u.day >= date_trunc('month', today::timestamp)::date;
  if v_limit is not null and v_used >= v_limit then
    raise exception 'ai_credits_exhausted' using errcode = 'P0001';
  end if;
  insert into public.ai_usage as u (user_id, day, requests) values (uid, today, 1)
    on conflict (user_id, day) do update set requests = u.requests + 1
    returning u.requests into v_requests;
  if v_requests > 1000 then
    raise exception 'ai_rate_limited' using errcode = 'P0001';
  end if;
  return jsonb_build_object('plan', v_plan, 'used', v_used, 'limit', v_limit);
end;
$$;

-- Bir şey değiştiren yanıttan sonra: bir kredi düşer, kullanılan ve toplam krediyi döndürür.
create function public.ai_spend() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  v_used integer;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  insert into public.ai_usage as u (user_id, day, credits) values (uid, today, 1)
    on conflict (user_id, day) do update set credits = u.credits + 1;
  select coalesce(sum(u.credits), 0)::integer into v_used
    from public.ai_usage u where u.user_id = uid and u.day >= date_trunc('month', today::timestamp)::date;
  return jsonb_build_object(
    'used', v_used,
    'limit', public.ai_credit_limit(coalesce((select p.plan from public.profiles p where p.user_id = uid), 'free'))
  );
end;
$$;

revoke execute on function public.ai_credit_limit(text) from public, anon, authenticated;
revoke execute on function public.ai_begin() from public, anon;
revoke execute on function public.ai_spend() from public, anon;
grant execute on function public.ai_begin() to authenticated;
grant execute on function public.ai_spend() to authenticated;

-- Ödeme henüz bağlı değil, hiçbir üyenin ücretli planı yok: özelliği denemek için site yöneticisine sınırsız plan.
update public.profiles set plan = 'unlimited' where is_admin;

commit;
