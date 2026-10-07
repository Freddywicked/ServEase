-- ============================================================================
-- ServEase — core workflow tables (migration 002)
-- Run ONCE in the Supabase SQL editor (Project > SQL Editor > New query > Run),
-- AFTER 001_align_schema_with_erd.sql. All statements are idempotent.
--
-- These tables back the endpoints the mobile app already calls:
--   notifications              - GET /api/notifications, written by every action
--   schedule_proposals         - provider proposes a new appointment; customer answers
--   payment_requests           - provider asks for additional payment; customer answers
--   progress_updates           - job stages pushed from the provider's Jobs screen
--   payments                   - customer payments (GCash / QR Ph / card), recorded
--                                server-side (PayMongo keys go in .env when ready)
--   ratings                    - customer's rating + review of a completed request
--   messages                   - customer <-> provider chat, one thread per request
--   provider_unavailable_slots - the provider dashboard's "Manage Calendar"
-- ============================================================================

BEGIN;

-- The customer's chosen address travels with the request (the mobile app sends it
-- from CreateServiceRequest; the provider sees it on ViewServiceRequest).
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS address text;

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  request_id uuid,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (notification_id),
  CONSTRAINT notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE,
  CONSTRAINT notifications_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.service_requests(request_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schedule_proposals (
  proposal_id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending', 'accepted', 'rejected'])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  CONSTRAINT schedule_proposals_pkey PRIMARY KEY (proposal_id),
  CONSTRAINT schedule_proposals_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.service_requests(request_id) ON DELETE CASCADE,
  CONSTRAINT schedule_proposals_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES public.service_providers(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS schedule_proposals_request_id_idx ON public.schedule_proposals (request_id);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_requests (
  payment_request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending', 'approved', 'rejected'])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  CONSTRAINT payment_requests_pkey PRIMARY KEY (payment_request_id),
  CONSTRAINT payment_requests_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.service_requests(request_id) ON DELETE CASCADE,
  CONSTRAINT payment_requests_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES public.service_providers(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS payment_requests_request_id_idx ON public.payment_requests (request_id);


-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.progress_updates (
  progress_id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  step text NOT NULL,
  notes text,
  photo_path text, -- storage path in the private request-photos bucket; sign on read
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT progress_updates_pkey PRIMARY KEY (progress_id),
  CONSTRAINT progress_updates_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.service_requests(request_id) ON DELETE CASCADE,
  CONSTRAINT progress_updates_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES public.service_providers(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS progress_updates_request_id_idx ON public.progress_updates (request_id, created_at);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  payment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  method text NOT NULL,          -- 'gcash' | 'qrph' | 'card'
  stage text NOT NULL DEFAULT 'final'
    CHECK (stage = ANY (ARRAY['initial', 'final', 'additional'])),
  status text NOT NULL DEFAULT 'paid'
    CHECK (status = ANY (ARRAY['paid', 'pending', 'failed', 'refunded'])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (payment_id),
  CONSTRAINT payments_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.service_requests(request_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS payments_request_id_idx ON public.payments (request_id);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ratings (
  rating_id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ratings_pkey PRIMARY KEY (rating_id),
  CONSTRAINT ratings_request_id_key UNIQUE (request_id), -- one rating per request
  CONSTRAINT ratings_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.service_requests(request_id) ON DELETE CASCADE,
  CONSTRAINT ratings_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES public.service_providers(user_id) ON DELETE CASCADE,
  CONSTRAINT ratings_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS ratings_provider_id_idx ON public.ratings (provider_id);

-- ---------------------------------------------------------------------------
-- One conversation per service request (the mobile flow sends a request to ONE
-- provider, so request + its two participants = the thread). sender_id decides
-- which side of the bubble; the seen flags drive the unread dot per viewer.
CREATE TABLE IF NOT EXISTS public.messages (
  message_id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  seen_by_customer boolean NOT NULL DEFAULT false,
  seen_by_provider boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (message_id),
  CONSTRAINT messages_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.service_requests(request_id) ON DELETE CASCADE,
  CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS messages_request_id_idx ON public.messages (request_id, created_at);

-- ---------------------------------------------------------------------------
-- The provider dashboard calendar: one row per slot the provider marked busy.
-- slot is stored 24-hour 'HH:00'; the API serves it 12-hour to the web app and
-- as 'YYYY-MM-DDTHH:00' strings to the mobile app.
CREATE TABLE IF NOT EXISTS public.provider_unavailable_slots (
  provider_id uuid NOT NULL,
  date date NOT NULL,
  slot text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT provider_unavailable_slots_pkey PRIMARY KEY (provider_id, date, slot),
  CONSTRAINT provider_unavailable_slots_provider_id_fkey
    FOREIGN KEY (provider_id) REFERENCES public.service_providers(user_id) ON DELETE CASCADE
);

COMMIT;
