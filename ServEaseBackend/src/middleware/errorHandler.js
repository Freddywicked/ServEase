/**
 * Centralised 404 and error handling.
 * @format
 */

export const notFoundHandler = (req, res) => {
  res
    .status(404)
    .json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  if (err.name === 'MulterError') {
    status = 400;
  }
  if (status >= 500) {
    console.error(err);
  }
  const message =
    status >= 500
      ? 'Something went wrong. Please try again later.'
      : err.message;
  res.status(status).json({ message });
};

export const httpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};
