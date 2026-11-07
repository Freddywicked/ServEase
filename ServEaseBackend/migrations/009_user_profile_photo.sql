-- Customer profile photo (Edit Profile screen). Safe to run more than once.
-- RUN THIS BEFORE deploying the code that selects the new column, otherwise every
-- authenticated request fails (users.select of PUBLIC_FIELDS).

-- users.photo_url stores the private storage PATH (bucket: profile-photos), never a
-- signed URL — signed URLs expire, so the server mints a fresh one on each read
-- (same pattern as service_providers.profile_photo).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS photo_url text;
