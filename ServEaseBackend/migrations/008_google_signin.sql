-- ============================================================================
-- ServEase — Google Sign-In support
-- Run ONCE in the Supabase SQL editor (Project > SQL Editor > New query > Run).
-- All statements are idempotent (safe to re-run).
--
-- Google accounts provide only email + name, so:
--   * google_id        — Google's stable account id (the ID token's "sub"),
--                        used to recognise the same Google account on any device.
--   * password_hash    — nullable: Google-only users have no password. Password
--                        login already fails safely for them (bcrypt.compare on
--                        NULL is false).
--   * phone_number     — nullable: collected afterwards via the complete-profile
--                        flow (POST /api/auth/phone/request-otp + /phone/verify),
--                        which keeps the one-account-per-phone rule (BR-01).
--   * address/birthdate/gender — nullable: Google doesn't provide them either;
--                        they stay optional profile fields.
-- ============================================================================

BEGIN;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_id text;

-- Unique index (not an ADD CONSTRAINT) so the migration stays re-runnable.
-- Postgres allows any number of NULLs in a unique column.
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key ON public.users (google_id);

ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN address DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN birthdate DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN gender DROP NOT NULL;

COMMIT;
