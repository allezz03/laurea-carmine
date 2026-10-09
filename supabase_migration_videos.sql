-- Abilita video fino a 50 MB nel bucket privato già utilizzato per le foto.
-- Esegui nel SQL Editor di Supabase prima del deploy del codice.

ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image';

ALTER TABLE public.photos
  DROP CONSTRAINT IF EXISTS photos_media_type_check;
ALTER TABLE public.photos
  ADD CONSTRAINT photos_media_type_check CHECK (media_type IN ('image', 'video'));

-- La tabella originale limitava size_bytes a 12 MiB. Ora il limite applicativo
-- è 50 MiB per entrambi i media, mentre il caricamento foto resta limitato a 12 MiB nel frontend/API.
ALTER TABLE public.photos
  DROP CONSTRAINT IF EXISTS photos_size_bytes_check;
ALTER TABLE public.photos
  ADD CONSTRAINT photos_size_bytes_check CHECK (size_bytes > 0 AND size_bytes <= 52428800);

UPDATE storage.buckets
SET public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/webp','image/heic','image/heif',
      'video/mp4','video/quicktime','video/webm'
    ]
WHERE id = 'laurea-photos';
