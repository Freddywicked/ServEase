/**
 * Error helpers shared by the whole backend.
 *
 * Throw httpError(status, message) or new ApiError(status, message) anywhere
 * and errorHandler turns it into JSON:
 *   { message, details?, error: { message, details? } }
 * `error` is what the web app reads; the top-level fields are for the mobile app.
 */

const httpError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
};

const send = (res, status, message, details) => {
  const extra = details ? { details } : {};
  res.status(status).json({ message, ...extra, error: { message, ...extra } });
};

// For any route that doesn't exist.
const notFoundHandler = (req, res) => {
  send(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};

// Must be registered last. Keep all four arguments so Express treats it
// as an error handler.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // File upload errors (multer) are the client's fault, not a server crash.
  if (err.name === 'MulterError') {
    err.status = 400;
    if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Each file must be 5 MB or smaller.';
  }
  // Malformed JSON body.
  if (err.type === 'entity.parse.failed') {
    err.status = 400;
    err.message = 'Invalid JSON in request body.';
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);

  const message =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Something went wrong.'
      : err.message || 'Something went wrong.';

  send(res, status, message, err.details);
};

module.exports = { httpError, notFoundHandler, errorHandler };