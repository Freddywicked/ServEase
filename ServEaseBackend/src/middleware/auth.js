/**
 * Authentication middleware: verifies the JWT access token sent as
 * "Authorization: Bearer <token>" and exposes req.user = { sub, role }.
 * @format
 */

import { verifyAccessToken } from '../utils/tokens.js';

export const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

/**
 * Role-based authorization, e.g. authorize('admin').
 */
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: 'You do not have permission to perform this action.' });
    }
    return next();
  };
