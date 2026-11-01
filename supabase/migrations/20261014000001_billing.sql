-- Ödeme (Stripe): abonelik kaydı, planın tek kaynağı ve yapay zekâ kredisinin abonelik gününde yenilenmesi
--
-- Ödeme sayfasını ve Stripe bildirimlerini Worker yürütür (src/billing/server.ts): `/api/billing/*`. Worker, Stripe'tan
-- okuduğu abonelik durumunu gizli anahtarla (service_role) billing_apply() üzerinden buraya yazar; plan yine
-- profiles.plan'da durur, depolama kotası ve yapay zekâ sınırları oradan okumaya devam eder.
-- * subscriptions: üye başına bir satır (Stripe müşteri ve abonelik kimliği, plan, durum, dönem). Üye tabloyu
--   okuyamaz; kendi durumunu billing_status() ile alır (Stripe kimlikleri tarayıcıya gitmez).
-- * billing_customer / billing_set_customer / billing_apply: yalnızca service_role çağırır.
-- * Plan: abonelik active, trialing ya da past_due iken (Stripe ödemeyi yeniden denerken erişim sürer) aboneliğin
--   planı; bitince ücretsiz. Yöneticiler abonelik bitince `unlimited`'a döner (ödemeyi kendi hesabıyla deneyen
--   yönetici elle verilmiş planını kaybetmesin).
-- * ai_period_start: kredi ve mesaj sayacı artık takvim ayına değil abonelik gününe göre döner (aboneliği
--   olmayanda takvim ayı, UTC). Bildirim kaçsa bile dönem ilerlesin diye ay dönümü dönem başından hesaplanır.

begin;

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'unlimited')),
  -- Stripe'ın abonelik durumu (active, trialing, past_due, canceled, unpaid, incomplete...); 'none' = abonelik yok
  status text not null default 'none',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
revoke all on table public.subscriptions from anon, authenticated;

-- Üyenin Stripe müşteri kimliği; yoksa null.
create function public.billing_customer(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select s.stripe_customer_id from public.subscriptions s where s.user_id = p_user;
$$;

-- Müşteri kimliğini kaydeder; üyenin zaten bir müşterisi varsa onu döndürür (iki sekmeden aynı anda ödeme
-- başlatılırsa tek müşteri kalır).
create function public.billing_set_customer(p_user uuid, p_customer text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_customer text;
begin
  insert into public.subscriptions (user_id, stripe_customer_id) values (p_user, p_customer)
    on conflict (user_id) do nothing;
  select s.stripe_customer_id into v_customer from public.subscriptions s where s.user_id = p_user;
  return v_customer;
end;
$$;

-- Stripe'taki güncel abonelik durumunu yazar ve planı günceller. Müşteri tanınmıyorsa ve p_user verilmişse
-- (aboneliğin metadata'sındaki üye) satırı açar; tanınmayan müşteride null döner (aynı Stripe hesabındaki başka
-- bir ürünün bildirimi: yok sayılır).
create function public.billing_apply(
  p_customer text,
  p_user uuid,
  p_subscription text,
  p_plan text,
  p_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel boolean
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
  v_plan text;
begin
  if p_plan is null or p_plan not in ('free', 'starter', 'pro', 'unlimited') then
    raise exception 'billing_unknown_plan' using errcode = 'P0001';
  end if;
  select s.user_id into uid from public.subscriptions s where s.stripe_customer_id = p_customer;
  if uid is null then
    if p_user is null or not exists (select 1 from auth.users u where u.id = p_user) then
      return null;
    end if;
    insert into public.subscriptions (user_id, stripe_customer_id) values (p_user, p_customer)
      on conflict (user_id) do nothing;
    select s.user_id into uid from public.subscriptions s where s.stripe_customer_id = p_customer;
    if uid is null then
      return null;
    end if;
  end if;
  update public.subscriptions set
    stripe_subscription_id = p_subscription,
    plan = p_plan,
    status = coalesce(p_status, 'none'),
    current_period_start = p_period_start,
    current_period_end = p_period_end,
    cancel_at_period_end = coalesce(p_cancel, false),
    updated_at = now()
  where user_id = uid;
  v_plan := case
    when p_status in ('active', 'trialing', 'past_due') then p_plan
    when coalesce((select p.is_admin from public.profiles p where p.user_id = uid), false) then 'unlimited'
    else 'free'
  end;
  insert into public.profiles (user_id, plan) values (uid, v_plan)
    on conflict (user_id) do update set plan = excluded.plan;
  return jsonb_build_object('user_id', uid, 'plan', v_plan);
end;
$$;

-- Kredi ve mesaj sayacının içinde bulunulan dönemi ne zaman başladı (UTC günü): abonelikte abonelik günü,
-- aboneliği olmayanda ayın ilk günü.
create function public.ai_period_start(uid uuid) returns date
language sql stable security definer set search_path = '' as $$
  with sub as (
    select (s.current_period_start at time zone 'utc') as t0, (now() at time zone 'utc') as t
    from public.subscriptions s
    where s.user_id = uid and s.status in ('active', 'trialing', 'past_due') and s.current_period_start is not null
  )
  select coalesce(
    (select (t0 + make_interval(months => greatest(0, (extract(year from age(t, t0)) * 12 + extract(month from age(t, t0)))::integer)))::date from sub),
    date_trunc('month', now() at time zone 'utc')::date
  );
$$;

-- Tarayıcı için: plan, abonelik durumu, dönem ve bu dönemde harcanan yapay zekâ kredisi.
create function public.billing_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'plan', coalesce((select p.plan from public.profiles p where p.user_id = auth.uid()), 'free'),
    'status', coalesce(s.status, 'none'),
    'subscribed', coalesce(s.status in ('active', 'trialing', 'past_due'), false),
    'period_start', public.ai_period_start(auth.uid()),
    'period_end', s.current_period_end,
    'cancel_at_period_end', coalesce(s.cancel_at_period_end, false),
    'ai_used', (
      select coalesce(sum(u.credits), 0)::integer from public.ai_usage u
      where u.user_id = auth.uid() and u.day >= public.ai_period_start(auth.uid())
    )
  )
  from (select auth.uid() as id) me
  left join public.subscriptions s on s.user_id = me.id;
$$;

-- ai_begin / ai_spend: 20261009000001'deki ile aynı, yalnızca dönem başı takvim ayı yerine ai_period_start.
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
    from public.ai_usage u where u.user_id = uid and u.day >= public.ai_period_start(uid);
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

create or replace function public.ai_spend() returns jsonb
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
    from public.ai_usage u where u.user_id = uid and u.day >= public.ai_period_start(uid);
  return jsonb_build_object(
    'used', v_used,
    'limit', public.ai_credit_limit(coalesce((select p.plan from public.profiles p where p.user_id = uid), 'free'))
  );
end;
$$;

revoke execute on function public.billing_customer(uuid) from public, anon, authenticated;
revoke execute on function public.billing_set_customer(uuid, text) from public, anon, authenticated;
revoke execute on function public.billing_apply(text, uuid, text, text, text, timestamptz, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.ai_period_start(uuid) from public, anon, authenticated;
revoke execute on function public.billing_status() from public, anon;
grant execute on function public.billing_customer(uuid) to service_role;
grant execute on function public.billing_set_customer(uuid, text) to service_role;
grant execute on function public.billing_apply(text, uuid, text, text, text, timestamptz, timestamptz, boolean) to service_role;
grant execute on function public.billing_status() to authenticated;

commit;
