/**
 * API client for the ServEase backend (see ServEaseBackend).
 *
 * The Android emulator reaches the host machine via 10.0.2.2.
 * Override the base URL when pointing at a deployed backend.
 * @format
 */

import { Platform } from 'react-native';

const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:5000/api',
  default: 'http://localhost:5000/api',
});

const request = async (path, { method = 'GET', token, body, formData } = {}) => {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: formData ?? (body ? JSON.stringify(body) : undefined),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      data.message || `Request failed (${response.status})`,
    );
    // Expose the status and payload so callers can branch on structured
    // errors (e.g. login responding 403 with { requiresOtp, phone }).
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
};

/**
 * Converts a document/image picker result
 * ({ uri, name, type }) into a React Native FormData file entry.
 */
const toFile = (file, fallbackName) =>
  file && {
    uri: file.uri,
    name: file.name || fallbackName,
    type: file.type || 'image/jpeg',
  };

// Auth --------------------------------------------------------------------

/**
 * Registers a customer account. `form` matches SignUpScreen state:
 * { fullName, email, phone, password, address }. Responds with { devOtp }
 * outside production.
 */
export const registerCustomer = (form, validId) => {
  const formData = new FormData();
  formData.append('fullName', form.fullName);
  formData.append('email', form.email);
  formData.append('phone', form.phone);
  formData.append('password', form.password);
  formData.append('address', form.address);
  if (validId) {
    formData.append('validId', toFile(validId, 'valid_id.jpg'));
  }
  return request('/auth/register', { method: 'POST', formData });
};

/** Verifies the 6-digit phone code. Responds with { token, user }. */
export const verifyOtp = (phone, code) =>
  request('/auth/verify-otp', { method: 'POST', body: { phone, code } });

export const resendOtp = phone =>
  request('/auth/resend-otp', { method: 'POST', body: { phone } });

/** Signs in with email/password. Responds with { token, user }. */
export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: { email, password } });

export const forgotPassword = email =>
  request('/auth/forgot-password', { method: 'POST', body: { email } });

export const resetPassword = (email, code, newPassword) =>
  request('/auth/reset-password', {
    method: 'POST',
    body: { email, code, newPassword },
  });

export const getMe = token => request('/auth/me', { token });

// Notifications -------------------------------------------------------------

/**
 * Lists the signed-in customer's notifications, newest first.
 * Responds with { notifications: [{ id, message, readAt, createdAt }] }.
 */
export const getNotifications = token => request('/notifications', { token });

/** Marks a notification as read. Responds with { notification }. */
export const markNotificationRead = (token, notificationId) =>
  request(`/notifications/${notificationId}/read`, { method: 'PATCH', token });

// Service requests (bookings) ------------------------------------------------

/**
 * Fetches the customer's active repair - the most recent service request in
 * a non-final status. Responds with { booking } (null when there is none):
 * { id, status, description, serviceName, providerName, scheduledAt,
 *   createdAt, updatedAt }.
 */
export const getActiveRepair = token => request('/bookings/active', { token });

// Service catalog ---------------------------------------------------------

/** Lists categories with their services for the application flow. */
export const getServiceCategories = () => request('/services/categories');

// Service provider application ---------------------------------------------

/**
 * Submits the 3-step service provider application.
 * `application` combines PersonalDetailsScreen and ServiceCategoryScreen state:
 * { firstName, middleName, lastName, dateOfBirth, gender, email, phone,
 *   address, categories: string[], services: string[], otherServices,
 *   yearsExperience, offersHomeService: 'yes' | 'no' }
 * `files`: { validId, selfie, supportingDocs } picker results.
 */
export const submitProviderApplication = (token, application, files) => {
  const formData = new FormData();
  formData.append('firstName', application.firstName);
  formData.append('middleName', application.middleName || '');
  formData.append('lastName', application.lastName);
  formData.append('dateOfBirth', application.dateOfBirth);
  formData.append('gender', application.gender);
  formData.append('email', application.email);
  formData.append('phone', application.phone);
  formData.append('address', application.address);
  formData.append('categories', JSON.stringify(application.categories));
  formData.append('services', JSON.stringify(application.services));
  formData.append('otherServices', application.otherServices || '');
  formData.append('yearsExperience', String(application.yearsExperience || 0));
  formData.append('offersHomeService', application.offersHomeService === 'yes' ? 'yes' : 'no');
  formData.append('agreeCertify', 'true');
  formData.append('agreeTerms', 'true');
  if (files?.validId) {
    formData.append('validId', toFile(files.validId, 'valid_id.jpg'));
  }
  if (files?.selfie) {
    formData.append('selfie', toFile(files.selfie, 'selfie.jpg'));
  }
  if (files?.supportingDocs) {
    formData.append(
      'supportingDocs',
      toFile(files.supportingDocs, 'supporting_docs.jpg'),
    );
  }
  return request('/providers/applications', { method: 'POST', token, formData });
};

export const getMyProviderApplication = token =>
  request('/providers/applications/me', { token });
