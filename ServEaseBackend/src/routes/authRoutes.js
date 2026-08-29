/**
 * Authentication routes.
 * OTP and password endpoints are rate limited to slow down brute force.
 * @format
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import upload from '../middleware/upload.js';
import { authenticate } from '../middleware/auth.js';
import {
  forgotPassword,
  login,
  me,
  register,
  resendOtp,
  resetPassword,
  verifyOtp,
} from '../controllers/authController.js';

const router = Router();

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});

router.post('/register', upload.single('validId'), register);
router.post('/verify-otp', otpLimiter, verifyOtp);
router.post('/resend-otp', otpLimiter, resendOtp);
router.post('/login', login);
router.post('/forgot-password', otpLimiter, forgotPassword);
router.post('/reset-password', otpLimiter, resetPassword);
router.get('/me', authenticate, me);

export default router;
