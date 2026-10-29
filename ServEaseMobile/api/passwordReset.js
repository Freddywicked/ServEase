// Password reset API calls (Forgot Password -> OTP -> New Password).
// Uses the shared request() from client.js, so it gets the same base URL, timeout
// and error shape (err.message / err.status / err.fieldErrors) as every other call.
import { request } from './client';

const clean = (email) => email.trim().toLowerCase();

// Step 1: backend emails a one-time code. Resolves { message, resendAfter }.
export const requestPasswordReset = (email) =>
    request('/auth/forgot-password', { method: 'POST', body: { email: clean(email) }, auth: false });

// Step 2: backend checks the code. Resolves { resetToken, expiresIn }.
export const verifyResetOtp = (email, otp) =>
    request('/auth/verify-reset-otp', { method: 'POST', body: { email: clean(email), otp }, auth: false });

// Step 3: backend saves the new password. Resolves { message }.
export const resetPassword = (email, resetToken, password) =>
    request('/auth/reset-password', {
        method: 'POST',
        body: { email: clean(email), resetToken, password },
        auth: false,
    });