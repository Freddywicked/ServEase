-- ============================================================================
-- ServEase - per-user conversation deletion (migration 014)
-- Run after 002_core_workflow_tables.sql in the Supabase SQL editor.
--
-- Deleting a conversation hides messages at or before deleted_at for one user.
-- The other participant keeps the complete history. Messages sent afterwards
-- are visible normally and make the conversation reappear for the deleting user.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.conversation_deletions (
  request_id uuid NOT NULL,
  user_id uuid NOT NULL,
  deleted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversation_deletions_pkey PRIMARY KEY (request_id, user_id),
  CONSTRAINT conversation_deletions_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.service_requests(request_id) ON DELETE CASCADE,
  CONSTRAINT conversation_deletions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS conversation_deletions_user_id_idx
  ON public.conversation_deletions (user_id, request_id);

COMMIT;
