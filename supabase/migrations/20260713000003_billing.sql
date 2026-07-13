-- Billing: provider customers, subscriptions, and an append-only credit
-- ledger. Users can read their own rows; every write goes through
-- security-definer functions or the service-role client.

create table public.billing_customers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null,
  provider_customer_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_customer_id)
);

alter table public.billing_customers enable row level security;

create policy "billing_customers select own" on public.billing_customers
  for select using (auth.uid() = user_id);
-- no insert/update/delete policies: service-role only

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_subscription_id text,
  plan_id text not null,
  status text not null default 'active'
    check (status in ('active', 'past_due', 'canceled', 'expired')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions select own" on public.subscriptions
  for select using (auth.uid() = user_id);
-- writes: service-role only

create index subscriptions_user_idx
  on public.subscriptions (user_id, status, created_at desc);
create unique index subscriptions_provider_ref
  on public.subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;

-- Append-only: balance is always sum(delta). No mutable balance column.
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta int not null check (delta <> 0),
  reason text not null,
  reference_id text,
  created_at timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;

create policy "credit_ledger select own" on public.credit_ledger
  for select using (auth.uid() = user_id);
-- writes: security-definer functions / service-role only

create index credit_ledger_user_idx
  on public.credit_ledger (user_id, created_at desc);

-- One signup grant per user, ever.
create unique index credit_ledger_signup_grant
  on public.credit_ledger (user_id)
  where reason = 'free_signup';

-- Compensations and webhook grants are idempotent per reference.
create unique index credit_ledger_once_per_ref
  on public.credit_ledger (user_id, reason, reference_id)
  where reference_id is not null
    and reason in ('refund', 'subscription_grant', 'pack_purchase');

-- Processed provider events; the webhook's idempotency memory.
create table public.billing_events (
  event_id text primary key,
  provider text not null,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;
-- no policies at all: service-role only

-- Atomic spend: lock the user's ledger, check the balance, insert the
-- debit — or fail cleanly. Runs as definer so authenticated users cannot
-- write the ledger directly; auth.uid() pins the target, so a caller can
-- only ever spend their own credits.
create or replace function public.spend_credits(
  p_amount int,
  p_reason text,
  p_reference text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance int;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- serialize concurrent spends per user
  perform pg_advisory_xact_lock(hashtext(v_user::text));

  select coalesce(sum(delta), 0) into v_balance
  from credit_ledger where user_id = v_user;

  if v_balance < p_amount then
    return false;
  end if;

  insert into credit_ledger (user_id, delta, reason, reference_id)
  values (v_user, -p_amount, p_reason, p_reference);

  return true;
end;
$$;

revoke all on function public.spend_credits(int, text, text) from public;
grant execute on function public.spend_credits(int, text, text) to authenticated;

-- Current balance for the signed-in user.
create or replace function public.credit_balance()
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(delta), 0)::int
  from credit_ledger
  where user_id = auth.uid();
$$;

revoke all on function public.credit_balance() from public;
grant execute on function public.credit_balance() to authenticated;
