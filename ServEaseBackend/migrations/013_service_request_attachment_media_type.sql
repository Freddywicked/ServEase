-- Preserve whether each service-request attachment is an image or a video.
-- Existing rows are backfilled from their stored filename/path; unknown legacy files remain images.
BEGIN;

ALTER TABLE public.service_request_attachments
  ADD COLUMN IF NOT EXISTS media_type text;

UPDATE public.service_request_attachments
SET media_type = CASE
  WHEN lower(COALESCE(filename, file_url, '')) ~ '\.(mp4|mov|m4v|3gp|webm|mkv)$'
    OR lower(COALESCE(file_url, '')) ~ '\.(mp4|mov|m4v|3gp|webm|mkv)$'
    THEN 'video'
  ELSE 'image'
END
WHERE media_type IS NULL;

ALTER TABLE public.service_request_attachments
  ALTER COLUMN media_type SET NOT NULL;

ALTER TABLE public.service_request_attachments
  DROP CONSTRAINT IF EXISTS service_request_attachments_media_type_check;

ALTER TABLE public.service_request_attachments
  ADD CONSTRAINT service_request_attachments_media_type_check
  CHECK (media_type IN ('image', 'video'));

COMMIT;
