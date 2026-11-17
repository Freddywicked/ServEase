-- Platform fee captured when a provider creates a quotation.
-- NULL is intentional for existing quotations: utils/pricing.js applies the configured fallback to them.
BEGIN;

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS service_fee numeric(12, 2);

ALTER TABLE public.quotations
  DROP CONSTRAINT IF EXISTS quotations_service_fee_nonnegative;

ALTER TABLE public.quotations
  ADD CONSTRAINT quotations_service_fee_nonnegative
  CHECK (service_fee IS NULL OR service_fee >= 0);

COMMIT;
