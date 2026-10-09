-- Esegui questo script nel SQL Editor del progetto Supabase.
-- Le foto sono private nello Storage e vengono servite solo tramite URL firmati.
create extension if not exists pgcrypto;

create table if not exists public.photos (
  id uuid primary key,
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 12582912),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.photos enable row level security;

-- L'accesso al database passa esclusivamente dalle API server-side con service role.
-- Nessuna policy anon/authenticated: le chiavi privilegiate non vanno mai nel frontend.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('laurea-photos', 'laurea-photos', false, 12582912,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = 12582912,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif'];

-- Nota: non esporre SUPABASE_SERVICE_ROLE_KEY nel frontend o in variabili VITE_*.
