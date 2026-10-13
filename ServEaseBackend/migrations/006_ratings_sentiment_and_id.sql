-- ============================================================================
-- ServEase — ratings table alignment (migration 006)
-- Run ONCE in the Supabase SQL editor (Project > SQL Editor > New query > Run),
-- AFTER 002_core_workflow_tables.sql. All statements are idempotent.
--
-- Why: on databases where the ratings table was created manually (instead of
-- by 002), the table has no rating_id primary key and carries an extra,
-- never-written sentiment column. PostgREST fails any query that names a
-- missing column, so the provider profile's review list — which selects
-- rating_id — silently returned "no reviews yet" even when ratings existed.
-- This migration aligns both variants of the table:
--   1. adds the sentiment column (AI sentiment label per review) everywhere
--   2. adds rating_id (+ primary key) where it is missing
-- ============================================================================

BEGIN;

-- The AI sentiment label of the review ('positive' | 'neutral' | 'negative'),
-- written by POST /api/service-requests/:requestId/rating (utils/ai_sentiment.js).
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS sentiment text;

-- rating_id: the stable primary key 002 defines; manually created tables may
-- lack it. Backfill rows that predate the column before enforcing NOT NULL.
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS rating_id uuid DEFAULT gen_random_uuid();
UPDATE public.ratings SET rating_id = gen_random_uuid() WHERE rating_id IS NULL;
ALTER TABLE public.ratings ALTER COLUMN rating_id SET NOT NULL;

-- Add the primary key only if the table does not already have one.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ratings'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.ratings ADD CONSTRAINT ratings_pkey PRIMARY KEY (rating_id);
  END IF;
END $$;

COMMIT;
