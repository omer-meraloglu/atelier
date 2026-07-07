-- Atelier core schema: assets, generations, video_generations.
-- Every table is owner-scoped via RLS on user_id = auth.uid().

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('model', 'product')),
  storage_path text not null,
  label text not null default '',
  thumbnail_path text,
  width int,
  height int,
  created_at timestamptz not null default now()
);

alter table public.assets enable row level security;

create policy "assets select own" on public.assets
  for select using (auth.uid() = user_id);
create policy "assets insert own" on public.assets
  for insert with check (auth.uid() = user_id);
create policy "assets update own" on public.assets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "assets delete own" on public.assets
  for delete using (auth.uid() = user_id);

create index assets_user_kind_idx
  on public.assets (user_id, kind, created_at desc);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  model_asset_id uuid not null references public.assets (id) on delete cascade,
  product_asset_id uuid not null references public.assets (id) on delete cascade,
  provider_model_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'failed')),
  result_path text,
  error text,
  params jsonb not null default '{}'::jsonb,
  latency_ms int,
  created_at timestamptz not null default now()
);

alter table public.generations enable row level security;

create policy "generations select own" on public.generations
  for select using (auth.uid() = user_id);
create policy "generations insert own" on public.generations
  for insert with check (auth.uid() = user_id);
create policy "generations update own" on public.generations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "generations delete own" on public.generations
  for delete using (auth.uid() = user_id);

create index generations_user_idx
  on public.generations (user_id, created_at desc);

create table public.video_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_kind text not null check (source_kind in ('asset', 'generation')),
  source_asset_id uuid references public.assets (id) on delete cascade,
  source_generation_id uuid references public.generations (id) on delete cascade,
  provider_model_id text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'failed')),
  result_path text,
  poster_path text,
  error text,
  params jsonb not null default '{}'::jsonb,
  duration_s numeric,
  latency_ms int,
  created_at timestamptz not null default now(),
  -- exactly one source: an uploaded asset or a prior try-on generation
  constraint video_generations_one_source check (
    (source_kind = 'asset'
      and source_asset_id is not null
      and source_generation_id is null)
    or
    (source_kind = 'generation'
      and source_generation_id is not null
      and source_asset_id is null)
  )
);

alter table public.video_generations enable row level security;

create policy "video_generations select own" on public.video_generations
  for select using (auth.uid() = user_id);
create policy "video_generations insert own" on public.video_generations
  for insert with check (auth.uid() = user_id);
create policy "video_generations update own" on public.video_generations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "video_generations delete own" on public.video_generations
  for delete using (auth.uid() = user_id);

create index video_generations_user_idx
  on public.video_generations (user_id, created_at desc);
