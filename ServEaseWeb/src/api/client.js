// Talks to ServEaseBackend. Adjust BASE_URL for your dev/prod setup
// (e.g. swap for an env var once you know if you're on CRA or Vite).
  const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getToken = () => localStorage.getItem('token');
const setToken = (token) => localStorage.setItem('token', token);
const clearToken = () => localStorage.removeItem('token');

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const isForm = body instanceof FormData;
  const headers = isForm ? {} : { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (res.status === 401 && auth) {
    clearToken();
    window.location.href = '/login'; // point this at your actual login route
  }
  if (!res.ok) {
  const err = new Error(data?.error?.message || data?.message || 'Request failed');
  err.status = res.status;
  err.details = data?.error?.details || data?.details;
  throw err;
}
  return data;
}

// Your signup screens collect fullName/phone; the backend expects
// name/phone_number. Mapped here so the screens don't need to know that.
const toRegistrationPayload = (form) => {
  const payload = {
    name: form.fullName,
    email: form.email,
    phone_number: form.phone,
    password: form.password,
  };
  if (form.address) payload.address = form.address;
  if (form.birthdate) payload.birthdate = form.birthdate;
  if (form.gender) payload.gender = form.gender;
  return payload;
};

export const requestOtp = (form) =>
  request('/auth/request-otp', { method: 'POST', body: toRegistrationPayload(form), auth: false });

export const register = async (form, otp) => {
  const data = await request('/auth/register', {
    method: 'POST',
    body: { ...toRegistrationPayload(form), otp },
    auth: false,
  });
  setToken(data.token); // this was missing before — register() never saved its token
  return data.user;
};

export const login = async (identifier, password) => {
  const body = identifier.includes('@') ? { email: identifier, password } : { username: identifier, password };
  const data = await request('/auth/login', { method: 'POST', body, auth: false });
  setToken(data.token);
  return { user: data.user, provider: data.provider };
};

export const logout = () => clearToken();
export const me = () => request('/auth/me');

export const submitProviderApplication = (step1, files) => {
  const body = new FormData();
  step1.categories.forEach((c) => body.append('categories', c));
  step1.services.forEach((s) => body.append('services', s));
  body.append('years_of_experience', step1.yearsOfExperience);
  body.append('offers_home_service', step1.offersHomeService);
  body.append('validId', files.validId);
  body.append('selfie', files.selfie);
  files.supportingDocs.forEach((f) => body.append('supportingDocs', f));
  return request('/providers/application', { method: 'POST', body });
};