-- Esegui questo script nel SQL Editor di Supabase.
-- La revisione è attiva per impostazione predefinita, così il comportamento attuale resta invariato.
create table if not exists public.app_settings (
  key text primary key,
  value boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

insert into public.app_settings (key, value)
values ('review_enabled', true)
on conflict (key) do nothing;

-- Le API server-side usano SUPABASE_SERVICE_ROLE_KEY; non creare policy pubbliche.
