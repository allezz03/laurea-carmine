-- Eseguire una sola volta nel SQL Editor di Supabase prima del deploy.
-- Aggiunge Proclamazione senza modificare né cancellare le foto esistenti.
alter table public.photos drop constraint if exists photos_event_check;
alter table public.photos add constraint photos_event_check
  check (event in ('Cena', 'Festa', 'Proclamazione'));

-- Password degli album: viene salvato solo l'hash scrypt e il salt, mai la password in chiaro.
create table if not exists public.album_passwords (
  event text primary key check (event in ('Cena', 'Festa', 'Proclamazione')),
  salt text not null,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.album_passwords enable row level security;
-- Nessuna policy anon/authenticated: accesso solo tramite API server-side con service role.

-- Abilita Proclamazione nella pagina iniziale.
insert into public.app_settings (key, value, updated_at)
values ('event_link_proclamazione', true, now())
on conflict (key) do nothing;
