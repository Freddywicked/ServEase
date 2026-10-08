-- ============================================================================
-- ServEase — FCM device tokens (migration 004)
-- Run ONCE in the Supabase SQL editor AFTER 003_paymongo_columns.sql.
-- Idempotent.
--
-- One row per device: the mobile app registers its Firebase Cloud Messaging
-- token after login (POST /api/devices) and removes it on logout. The backend
-- sends a push for every NOTIFICATION row (see utils/push.js).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.device_tokens (
  fcm_token text NOT NULL,
  user_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'android',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT device_tokens_pkey PRIMARY KEY (fcm_token),
  CONSTRAINT device_tokens_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS device_tokens_user_id_idx ON public.device_tokens (user_id);

COMMIT;
