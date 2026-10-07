-- ============================================================================
-- ServEase — align the live database with the updated ERD
-- Run ONCE in the Supabase SQL editor (Project > SQL Editor > New query > Run).
-- The DROP/ADD statements are idempotent; the RENAME statements are not, so
-- do not run this file twice.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- USER: the ERD names the primary key user_id (was "id").
-- The foreign keys customers.user_id and service_providers.user_id follow the
-- rename automatically. The ERD's "password" attribute stays named
-- password_hash — it stores a bcrypt hash, never a plain password.
-- ---------------------------------------------------------------------------
ALTER TABLE public.users RENAME COLUMN id TO user_id;

-- ---------------------------------------------------------------------------
-- SERVICE_PROVIDER (ERD): user_id, years_of_experience, company_name,
-- company_address, verification_status, government_id, certification,
-- availability.
-- Drop the pre-normalization leftovers the ERD replaced:
--   service_categories / services_offered -> SERVICE_PROVIDER_SPECIALIZATION rows
--   valid_id_path / selfie_path / supporting_docs_paths
--     -> government_id / profile_photo / certification
-- (profile_photo, applied_at and rejection_reason are kept: the app and the
-- admin dashboard use them; they are operational extras on top of the ERD.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_providers
  DROP COLUMN IF EXISTS service_categories,
  DROP COLUMN IF EXISTS services_offered,
  DROP COLUMN IF EXISTS valid_id_path,
  DROP COLUMN IF EXISTS selfie_path,
  DROP COLUMN IF EXISTS supporting_docs_paths;

-- ---------------------------------------------------------------------------
-- SERVICE_PROVIDER_SPECIALIZATION (ERD): specialization_id, provider_id,
-- service_category, specialization_name, offers_home_service.
-- offers_home_service moves here from service_providers; the existing value is
-- copied onto every specialization row of the provider before the old column
-- is dropped.
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_provider_specialization
  ADD COLUMN IF NOT EXISTS service_category text,
  ADD COLUMN IF NOT EXISTS offers_home_service boolean NOT NULL DEFAULT false;

UPDATE public.service_provider_specialization s
SET offers_home_service = COALESCE(p.offers_home_service, false)
FROM public.service_providers p
WHERE p.user_id = s.provider_id;

-- A specialization row that IS a category selection is its own service_category.
UPDATE public.service_provider_specialization
SET service_category = specialization_name
WHERE service_category IS NULL
  AND specialization_name IN (
    'IT-Related Device Repair',
    'Phone Repair',
    'Automotive Services',
    'Home Repair Services'
  );

ALTER TABLE public.service_providers DROP COLUMN IF EXISTS offers_home_service;

-- ---------------------------------------------------------------------------
-- SERVICE_REQUEST (ERD): request_id, customer_id, provider_id, category,
-- description, ai_diagnosis, longitude, latitude, request_status, time, date.
--   request_date -> date, request_time -> time
--   provider_id becomes nullable: a request is created before any provider is
--   chosen, and provider_id is set when the customer accepts a quotation
--   (ERD: SERVICE_REQUEST "Accepted by" SERVICE_PROVIDER).
--   request_status gains 'Resolved' (customer fixed it with the AI's help)
--   and 'Cancelled'.
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_requests RENAME COLUMN request_date TO date;
ALTER TABLE public.service_requests RENAME COLUMN request_time TO time;
ALTER TABLE public.service_requests ALTER COLUMN provider_id DROP NOT NULL;

ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_request_status_check;
ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_request_status_check
  CHECK (request_status = ANY (ARRAY[
    'New',         -- draft: created, not yet sent to any provider
    'Pending',     -- sent to provider(s), waiting for quotations
    'Approved',    -- a quotation was accepted
    'Declined',
    'Rejected',
    'In Progress',
    'Completed',
    'Resolved',    -- customer fixed it with the AI diagnosis
    'Cancelled'
  ]));

-- ---------------------------------------------------------------------------
-- SERVICE_PROVIDER "Receives" / "Accepts" SERVICE_REQUEST (ERD relationship):
-- one request is sent to up to 5 providers and each responds once. The quotes
-- themselves live in QUOTATION (request_id + provider_id), per the ERD.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_request_providers (
  request_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status = ANY (ARRAY['sent', 'quoted', 'accepted', 'declined'])),
  declined_reason text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  CONSTRAINT service_request_providers_pkey PRIMARY KEY (request_id, provider_id),
  CONSTRAINT service_request_providers_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.service_requests(request_id) ON DELETE CASCADE,
  CONSTRAINT service_request_providers_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES public.service_providers(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS service_request_providers_provider_id_idx
  ON public.service_request_providers (provider_id);

COMMIT;
