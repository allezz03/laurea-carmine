-- Esegui questa migrazione una sola volta nel SQL Editor di Supabase.
-- Le sottoscrizioni sono gestite solo dalle API server-side con service role.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
-- Nessuna policy anon/authenticated: accesso esclusivamente tramite API server-side.
