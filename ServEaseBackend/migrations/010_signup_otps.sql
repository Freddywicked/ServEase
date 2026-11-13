-- ============================================================================
-- ServEase — signup and phone-verification OTP storage (migration 010)
-- Run after 009_user_profile_photo.sql. Safe to re-run.
-- The backend uses the Supabase secret key; RLS blocks public table access.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.signup_otps (
  email text PRIMARY KEY,
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_sent_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signup_otps_expires_at_idx
  ON public.signup_otps (expires_at);

ALTER TABLE public.signup_otps ENABLE ROW LEVEL SECURITY;

COMMIT;
