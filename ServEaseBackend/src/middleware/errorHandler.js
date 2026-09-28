/**
 * Error helpers shared by the whole backend.
 *
 * Throw httpError(status, message) anywhere in a controller or service and
 * errorHandler turns it into a JSON response. Express 5 passes errors from
 * async route functions here automatically, so no try/catch wrappers are
 * needed just to forward errors.
 */

import config from '../config/index.js';

export const httpError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

// For any route that doesn't exist.
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
};

// Must be registered last, after all routes. Express recognises it as an error
// handler because it takes four arguments, so keep `next` even though it's
// unused.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(err);
  }

  // In production, don't leak internal error text on unexpected failures.
  const message =
    status >= 500 && config.nodeEnv === 'production'
      ? 'Something went wrong.'
      : err.message || 'Something went wrong.';

  res.status(status).json({
    error: { message, ...(err.details ? { details: err.details } : {}) },
  });
};