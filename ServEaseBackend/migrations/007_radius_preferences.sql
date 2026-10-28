-- Radius feature. Safe to run more than once. RUN THIS BEFORE deploying the code that
-- selects the new columns, otherwise every authenticated request fails (users.select).
-- Rename the file to fit your migration numbering (e.g. 010_radius_preferences.sql).

-- Customer defaults: "Home Service" preference + provider search radius (km)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS prefers_home_service boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS search_radius_km integer NOT NULL DEFAULT 15;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_search_radius_km_check,
  ADD CONSTRAINT users_search_radius_km_check CHECK (search_radius_km BETWEEN 5 AND 100);

-- Provider: how far they travel for home service (NULL = not set / no home service)
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS home_service_radius_km integer;

ALTER TABLE public.service_providers
  DROP CONSTRAINT IF EXISTS service_providers_home_radius_check,
  ADD CONSTRAINT service_providers_home_radius_check
    CHECK (home_service_radius_km IS NULL OR home_service_radius_km BETWEEN 5 AND 100);

-- Request: where the repair happens, chosen on CreateServiceRequest
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS service_location_type text;

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_location_type_check,
  ADD CONSTRAINT service_requests_location_type_check
    CHECK (service_location_type IS NULL OR service_location_type IN ('home', 'shop'));

-- Providers who already offer home service get a default range they can change later.
-- offers_home_service is stored per row of service_provider_specialization, not on service_providers.
UPDATE public.service_providers sp
   SET home_service_radius_km = 10
 WHERE sp.home_service_radius_km IS NULL
   AND EXISTS (
     SELECT 1 FROM public.service_provider_specialization s
      WHERE s.provider_id = sp.user_id AND s.offers_home_service = true
   );