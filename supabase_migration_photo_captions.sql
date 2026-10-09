-- Aggiunge la didascalia facoltativa in stile Polaroid alle foto. Eseguire una sola volta nel SQL Editor Supabase.
alter table public.photos add column if not exists caption text;
