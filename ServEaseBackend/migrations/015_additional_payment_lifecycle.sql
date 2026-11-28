-- ============================================================================
-- ServEase — additional-payment lifecycle (migration 015)
-- Run AFTER 005_payments_missing_columns.sql. All statements are idempotent.
--
-- Approval and settlement are separate events:
--   deferred_at             customer explicitly chose Pay Later
--   payments.payment_request_id  identifies the request settled by a Pay Now payment
-- ============================================================================

BEGIN;

ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS deferred_at timestamp with time zone;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_request_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_payment_request_id_fkey'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_payment_request_id_fkey
      FOREIGN KEY (payment_request_id) REFERENCES public.payment_requests(payment_request_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS payment_requests_provider_active_idx
  ON public.payment_requests (provider_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_payment_request_id_idx
  ON public.payments (payment_request_id);

COMMIT;
