const jwt = require('jsonwebtoken');

const getSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing from .env');
  return process.env.JWT_SECRET;
};

// The token only carries the user id; roles are looked up on each request.
const signToken = (user) =>
  jwt.sign({ sub: String(user.user_id) }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const verifyToken = (token) => jwt.verify(token, getSecret());

module.exports = { signToken, verifyToken };