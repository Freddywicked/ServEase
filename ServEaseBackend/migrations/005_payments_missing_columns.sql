-- ============================================================================
-- ServEase — payments table: add the columns the API actually uses (migration 005)
-- Run ONCE in the Supabase SQL editor AFTER 003_paymongo_columns.sql.
-- Idempotent.
--
-- Why: the live `payments` table predates 002_core_workflow_tables.sql, so that
-- migration's CREATE TABLE IF NOT EXISTS was a no-op and the new columns were
-- never added. The live table still has the original ERD shape
-- (payment_type, payment_method, payment_status, transaction_reference,
--  payment_date), while the code writes/reads method, stage, status, created_at
-- (payForRequest, getPaymentStatus, paymongoWebhook, provider earnings).
-- Symptom before this fix: GET /api/service-requests/tracking and the earnings
-- endpoint answered 500 ("column payments.created_at does not exist"), and every
-- payment attempt failed its INSERT.
-- ============================================================================

BEGIN;

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'paid';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone NOT NULL DEFAULT now();

-- Backfill the new columns from the original ERD columns for existing rows.
UPDATE public.payments SET method = payment_method WHERE method IS NULL AND payment_method IS NOT NULL;
UPDATE public.payments SET stage = payment_type WHERE stage IS NULL AND payment_type IS NOT NULL;
UPDATE public.payments SET status = payment_status WHERE payment_status IS NOT NULL;
UPDATE public.payments SET created_at = payment_date WHERE payment_date IS NOT NULL;

COMMIT;
