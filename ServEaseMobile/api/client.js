// Talks to ServEaseBackend. Requires: npm i @react-native-async-storage/async-storage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ----------------------------------------------------------------------------
// SERVER ADDRESS: pick ONE option. It must match the backend's port (5000).
//
//  A) Android emulator:                        'http://10.0.2.2:5000/api'
//  B) Emulator or USB phone + `adb reverse tcp:5000 tcp:5000`:
//                                              'http://localhost:5000/api'
//  C) Physical phone on the same Wi-Fi:        'http://192.168.x.x:5000/api'  (ipconfig -> IPv4)
//  iOS simulator:                              'http://localhost:5000/api'
//
// Test: open `${BASE_URL}/health` in the PHONE's browser. If it doesn't load there,
// the app can't reach it either.
// ----------------------------------------------------------------------------
const BASE_URL = Platform.select({
  android: 'http://192.168.100.248:5000/api',
  ios: 'http://localhost:5000/api',
  default: 'http://localhost:5000/api',
});

const TOKEN_KEY = 'token';
const TIMEOUT_MS = 15000;

let onUnauthorized = null;
export const setOnUnauthorized = (fn) => {
  onUnauthorized = fn;
};

// Backend field names -> SignupScreen field names.
const FIELD_MAP = {
  name: 'fullName',
  email: 'email',
  phone_number: 'phone',
  password: 'password',
  address: 'address',
  birthdate: 'birthdate',
  gender: 'gender',
};

const toFormErrors = (details) => {
  if (!details || typeof details !== 'object') return null;
  const out = {};
  Object.entries(details).forEach(([key, msg]) => {
    out[FIELD_MAP[key] || key] = String(msg);
  });
  return Object.keys(out).length ? out : null;
};

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const url = `${BASE_URL}${path}`;
  // FormData (file uploads) must NOT get a manual Content-Type — fetch needs
  // to generate its own multipart boundary, which a hardcoded header breaks.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers = { Accept: 'application/json' };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  if (__DEV__) console.log(`[api] -> ${method} ${url}`);

  // Without a timeout, a wrong IP can leave "Sending code..." spinning for minutes.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (networkError) {
    const timedOut = networkError.name === 'AbortError';
    if (__DEV__) console.log(`[api] x  ${method} ${url} ->`, timedOut ? 'TIMEOUT' : networkError.message);
    const err = new Error(
      timedOut
        ? `The server at ${BASE_URL} did not respond. Check the IP/port and that the backend is running.`
        : `Cannot reach the server at ${BASE_URL}. Is the backend running?`
    );
    err.isNetworkError = true;
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (__DEV__) console.log(`[api] <- ${res.status} ${method} ${url}`);

  // Only for logged-in requests (a wrong password on /auth/login is also 401).
  if (res.status === 401 && auth) {
    await AsyncStorage.removeItem(TOKEN_KEY);
    onUnauthorized?.();
  }

  if (!res.ok) {
    const baseMessage = data?.error?.message || data?.message || `Request failed (${res.status})`;
    let fieldErrors = toFormErrors(data?.error?.details ?? data?.details);

    if (!fieldErrors && res.status === 409) {
      if (/email/i.test(baseMessage)) fieldErrors = { email: baseMessage };
      else if (/phone/i.test(baseMessage)) fieldErrors = { phone: baseMessage };
    }

    const err = new Error(fieldErrors ? Object.values(fieldErrors).join('\n') : baseMessage);
    err.status = res.status;
    err.fieldErrors = fieldErrors;
    throw err;
  }
  return data;
}

const toRegistrationPayload = (form) => {
  const payload = {
    name: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    phone_number: form.phone.trim(),
    password: form.password,
  };
  if (form.address) payload.address = form.address.trim();
  if (form.birthdate) payload.birthdate = form.birthdate; // 'YYYY-MM-DD'
  if (form.gender) payload.gender = form.gender;          // 'male' | 'female'
  return payload;
};

export const API_BASE_URL = BASE_URL;
export const getToken = () => AsyncStorage.getItem(TOKEN_KEY);
export const healthCheck = () => request('/health', { auth: false });

export const requestOtp = (form) =>
  request('/auth/request-otp', { method: 'POST', body: toRegistrationPayload(form), auth: false });

export const register = async (form, otp) => {
  const data = await request('/auth/register', {
    method: 'POST',
    body: { ...toRegistrationPayload(form), otp },
    auth: false,
  });
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  return data.user;
};

export const login = async (identifier, password) => {
  const id = identifier.trim();
  const body = id.includes('@') ? { email: id.toLowerCase(), password } : { username: id.toLowerCase(), password };
  const data = await request('/auth/login', { method: 'POST', body, auth: false });
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  return { user: data.user, provider: data.provider };
};

export const logout = () => AsyncStorage.removeItem(TOKEN_KEY);
export const me = () => request('/auth/me');

// Confirmed against provider_routes.js: the real path is /apply, and it
// expects the files under validId/selfie/supportingDocs — see the matching
// fix in ServiceProviderVerificationRequirements.js.
export const submitServiceProviderApplication = (formData) =>
  request('/providers/apply', { method: 'POST', body: formData });

// Logged-in provider's own profile (experience, specializations, photo, status).
// Returns { provider } — provider is null when the user has not applied.
export const getProviderProfile = () => request('/providers/me');

// Persists which side of the app the account is using, so it opens in the same
// mode on the next login. mode: 'customer' | 'service_provider'.
// BACKEND: needs PATCH /api/users/me to accept { activeMode } and store it on the user.
// Returns the backend's response (ideally the updated user).
export const setActiveMode = (mode) =>
  request('/users/me', { method: 'PATCH', body: { activeMode: mode } });