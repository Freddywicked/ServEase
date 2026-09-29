// Throw this anywhere: throw new ApiError(404, 'Request not found');
// Sets both `statusCode` and `status` so it works with most error handlers.
class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.status = statusCode;
    this.details = details; // e.g. per-field validation messages
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;