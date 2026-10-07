-- ============================================================================
-- ServEase — PayMongo columns (migration 003)
-- Run ONCE in the Supabase SQL editor AFTER 002_core_workflow_tables.sql.
-- Idempotent.
--
-- checkout_session_id links a PAYMENT row to its PayMongo Checkout Session
-- (cs_...); paymongo_payment_id is PayMongo's own payment id once paid.
-- ============================================================================

BEGIN;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS checkout_session_id text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paymongo_payment_id text;
CREATE INDEX IF NOT EXISTS payments_checkout_session_id_idx
  ON public.payments (checkout_session_id);

COMMIT;
