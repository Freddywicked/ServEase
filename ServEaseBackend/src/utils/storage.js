/**
 * Uploads verification documents (valid ID, selfie, supporting docs)
 * to a private Supabase Storage bucket.
 * @format
 */

import config from '../config/index.js';
import { getSupabase } from '../config/supabase.js';

const sanitizeExtension = fileName => {
  const extension = (fileName.split('.').pop() || 'bin')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return extension || 'bin';
};

/**
 * Streams a multer memory file to Supabase Storage and returns its path.
 * The bucket is private, so the path is later exchanged for a signed URL.
 */
export const uploadVerificationDocument = async (ownerId, kind, file) => {
  const supabase = getSupabase();
  const path = `${ownerId}/${kind}-${Date.now()}.${sanitizeExtension(
    file.originalname,
  )}`;
  const { error } = await supabase.storage
    .from(config.supabase.storageBucket)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) {
    const uploadError = new Error(`Failed to upload ${kind}: ${error.message}`);
    uploadError.statusCode = 502;
    throw uploadError;
  }
  return path;
};

/** Creates a short-lived signed URL for a stored document path. */
export const createSignedUrl = async (path, expiresInSeconds = 3600) => {
  if (!path) {
    return null;
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.storage
    .from(config.supabase.storageBucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    return null;
  }
  return data.signedUrl;
};
