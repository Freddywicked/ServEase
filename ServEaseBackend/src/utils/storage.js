// Works with either export style from config/supabase.js:
//   module.exports = supabase         or         module.exports = { supabase }
const supabaseModule = require('../config/supabase');
const supabase = supabaseModule.supabase || supabaseModule;

// PRIVATE buckets: provider IDs/selfies, and customers' repair photos. No public URLs.
const BUCKET = 'provider-applications';
const SERVICE_REQUEST_BUCKET = 'service-request-photos';

// Creates a bucket (private) if it doesn't exist yet. Runs once per bucket per server
// start; later uploads reuse the result. Needs the service/secret key, which your config
// already uses. (One entry per bucket — the old version tracked a single bucket.)
const bucketReady = {};

const ensureBucket = (bucket) => {
  if (!bucketReady[bucket]) {
    bucketReady[bucket] = (async () => {
      const { data } = await supabase.storage.getBucket(bucket);
      if (data) return;

      const { error } = await supabase.storage.createBucket(bucket, { public: false });
      // Ignore "already exists" in case of a race or a slow dashboard refresh.
      if (error && !/already exists/i.test(error.message)) {
        throw new Error(`Could not create bucket "${bucket}": ${error.message}`);
      }
    })().catch((err) => {
      bucketReady[bucket] = null; // let the next request try again
      throw err;
    });
  }
  return bucketReady[bucket];
};

// Uploads one file and returns the storage PATH (not a URL). Signed URLs expire, so don't
// store one; sign a fresh short-lived one only when something needs to display the file.
const uploadFile = async (bucket, userId, kind, file) => {
  await ensureBucket(bucket);

  const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase();
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw new Error(`Upload failed (${kind}): ${error.message}`);

  return path;
};

// Same behaviour as before.
const uploadProviderFile = (userId, kind, file) => uploadFile(BUCKET, userId, kind, file);

// Customer's photo for a service request. The app stores the returned path on the request.
const uploadServiceRequestPhoto = (userId, file) => uploadFile(SERVICE_REQUEST_BUCKET, userId, 'photo', file);

// Short-lived link for showing a request photo (tracking cards, the provider's request view,
// the AI diagnosis call). Returns null if there is no path or signing fails.
const getServiceRequestPhotoUrl = async (path, seconds = 60 * 10) => {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(SERVICE_REQUEST_BUCKET).createSignedUrl(path, seconds);
  return error ? null : data.signedUrl;
};

// Same, for a file in the provider-applications bucket (e.g. a provider's profile
// photo shown on the recommended-provider cards). service_providers.profile_photo
// stores the private PATH, so sign it on the way out.
const getProviderFileUrl = async (path, seconds = 60 * 10) => {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  return error ? null : data.signedUrl;
};

module.exports = {
  uploadProviderFile,
  uploadServiceRequestPhoto,
  getServiceRequestPhotoUrl,
  getProviderFileUrl,
  BUCKET,
  SERVICE_REQUEST_BUCKET,
};