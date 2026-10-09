-- Migrazione album Cena/Festa per Laurea di Carmine. Eseguire una sola volta in Supabase SQL Editor.
alter table public.photos
  add column if not exists event text not null default 'Festa';

alter table public.photos
  drop constraint if exists photos_event_check;
alter table public.photos
  add constraint photos_event_check check (event in ('Cena', 'Festa'));

-- Le foto già presenti vengono assegnate all'album Festa.
