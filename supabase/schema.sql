-- Saved calculator scenarios, one row per (user, scenario name).
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- "Profiles" live here too: the app treats the most-recently-updated scenario
-- as the user's default and pre-fills the form with it on sign-in. A user
-- saving under a new name creates a separate scenario ("retire at 50" vs
-- "retire at 55"); saving under an existing name overwrites it (upsert on
-- user_id + name).

create table public.scenarios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  inputs     jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Row-level security: users can only touch their own rows.
alter table public.scenarios enable row level security;

create policy "select own scenarios" on public.scenarios
  for select using (auth.uid() = user_id);

create policy "insert own scenarios" on public.scenarios
  for insert with check (auth.uid() = user_id);

create policy "update own scenarios" on public.scenarios
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own scenarios" on public.scenarios
  for delete using (auth.uid() = user_id);
