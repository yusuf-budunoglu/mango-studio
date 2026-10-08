-- Yapay zekâyla düzenleme: plan başına aylık mesaj sınırı (zarar sınırı)
--
-- Kredi yalnızca bir şey değiştiren yanıtta düşüyor; bir şey değiştirmeyen istekler de (yapılamayan istek, hata)
-- modele gidip para harcıyor ve sınırsız planda hiç aylık sınır yoktu. Artık modele giden her istek ("mesaj")
-- ayda plan başına sınırlı: en pahalı istekle bile (0,004 $) aylık toplam plan fiyatının altında kalır.
-- * ai_message_limit: starter 300, pro 750, unlimited 1500 mesaj / ay (ücretsiz planda özellik yok).
-- * ai_credit_limit yarıya indi: starter 150, pro 500 kredi / ay (unlimited sınırsız, ücretsiz 0).
--   Rakamlar src/billing/plans.ts `aiMessages` / `aiCredits` ile aynı olmalı (ai.test.ts kontrol eder).
-- * Günlük sınır her planda 1000'den 150'ye indi.
-- * Yeni hata: ai_message_limit_reached (bu ayın mesaj sınırı doldu).

begin;

-- Planın aylık yapay zekâ mesajı sınırı (modele giden her istek sayılır).
create function public.ai_message_limit(p_plan text) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan
    when 'starter' then 300
    when 'pro' then 750
    when 'unlimited' then 1500
    else 0
  end;
$$;

-- Planın aylık yapay zekâ kredisi (bir şey değiştiren düzenleme başına 1): 0 = planda yok, null = sınırsız.
create or replace function public.ai_credit_limit(p_plan text) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan
    when 'starter' then 150
    when 'pro' then 500
    when 'unlimited' then null
    else 0
  end;
$$;

-- İstekten önce: plan, aylık kredi, aylık mesaj ve günlük mesaj sınırı uygunsa günün istek sayacını artırır.
-- Hatalar: ai_plan_required (planda kredi yok), ai_credits_exhausted (bu ayın kredisi bitti),
-- ai_message_limit_reached (bu ayın mesaj sınırı doldu), ai_rate_limited (günde 150 mesaj).
create or replace function public.ai_begin() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  v_plan text;
  v_limit integer;
  v_used integer;
  v_messages integer;
  v_message_limit integer;
  v_requests integer;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  select coalesce((select p.plan from public.profiles p where p.user_id = uid), 'free') into v_plan;
  v_limit := public.ai_credit_limit(v_plan);
  v_message_limit := public.ai_message_limit(v_plan);
  if v_limit = 0 or v_message_limit = 0 then
    raise exception 'ai_plan_required' using errcode = 'P0001';
  end if;
  select coalesce(sum(u.credits), 0)::integer, coalesce(sum(u.requests), 0)::integer into v_used, v_messages
    from public.ai_usage u where u.user_id = uid and u.day >= date_trunc('month', today::timestamp)::date;
  if v_limit is not null and v_used >= v_limit then
    raise exception 'ai_credits_exhausted' using errcode = 'P0001';
  end if;
  if v_messages >= v_message_limit then
    raise exception 'ai_message_limit_reached' using errcode = 'P0001';
  end if;
  insert into public.ai_usage as u (user_id, day, requests) values (uid, today, 1)
    on conflict (user_id, day) do update set requests = u.requests + 1
    returning u.requests into v_requests;
  if v_requests > 150 then
    raise exception 'ai_rate_limited' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'plan', v_plan, 'used', v_used, 'limit', v_limit,
    'messages', v_messages + 1, 'message_limit', v_message_limit
  );
end;
$$;

revoke execute on function public.ai_message_limit(text) from public, anon, authenticated;
revoke execute on function public.ai_credit_limit(text) from public, anon, authenticated;
revoke execute on function public.ai_begin() from public, anon;
grant execute on function public.ai_begin() to authenticated;

commit;
