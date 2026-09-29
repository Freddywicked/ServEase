// Wraps an async route/middleware so a thrown error reaches errorHandler.js.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);