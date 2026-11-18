-- Per-request provider search radius chosen on the web Create Service Request screen.
-- NULL keeps older requests on the server's default radius.
BEGIN;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS search_radius_km integer;

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_search_radius_check;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_search_radius_check
  CHECK (search_radius_km IS NULL OR search_radius_km BETWEEN 5 AND 100);

COMMIT;
