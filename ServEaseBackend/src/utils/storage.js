// Works with either export style from config/supabase.js:
//   module.exports = supabase         or         module.exports = { supabase }
const supabaseModule = require('../config/supabase');
const supabase = supabaseModule.supabase || supabaseModule;

// PRIVATE bucket: these are government IDs and selfies, so no public URLs.
const BUCKET = 'provider-applications';

// Creates the bucket (private) if it doesn't exist yet. Runs once per server
// start; later uploads reuse the result. Needs the service/secret key, which
// your config already uses.
let bucketReady = null;

const ensureBucket = () => {
  if (!bucketReady) {
    bucketReady = (async () => {
      const { data } = await supabase.storage.getBucket(BUCKET);
      if (data) return;

      const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
      // Ignore "already exists" in case of a race or a slow dashboard refresh.
      if (error && !/already exists/i.test(error.message)) {
        throw new Error(`Could not create bucket "${BUCKET}": ${error.message}`);
      }
    })().catch((err) => {
      bucketReady = null; // let the next request try again
      throw err;
    });
  }
  return bucketReady;
};

// Uploads one file and returns the storage PATH (not a URL). Signed URLs
// expire, so don't store one. Generate a fresh short-lived one only when
// something (e.g. an admin review screen) needs to display it:
//
//   const { data } = await supabase.storage.from(BUCKET)
//     .createSignedUrl(path, 60 * 10); // 10 minutes
const uploadProviderFile = async (userId, kind, file) => {
  await ensureBucket();

  const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase();
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw new Error(`Upload failed (${kind}): ${error.message}`);

  return path;
};

module.exports = { uploadProviderFile, BUCKET };