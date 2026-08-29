/**
 * JWT access token helpers.
 * @format
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export const signAccessToken = user =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

export const verifyAccessToken = token => jwt.verify(token, config.jwt.secret);
