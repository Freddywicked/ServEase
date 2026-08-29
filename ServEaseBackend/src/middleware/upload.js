/**
 * Multer configuration for verification document uploads.
 * Files are kept in memory and streamed straight to Supabase Storage.
 * @format
 */

import multer from 'multer';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(null, true);
    }
    const error = new Error('Only JPEG, PNG, WebP or PDF files are allowed.');
    error.statusCode = 400;
    return cb(error);
  },
});

export default upload;
