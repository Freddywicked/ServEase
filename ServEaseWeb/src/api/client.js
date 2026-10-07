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
export const getAdminStats = () => request('/admin/stats');

// Step 1 stores category keys; the backend stores and compares category NAMES
// (provider_controllers.js looks for exactly 'Home Repair Services').
const CATEGORY_NAMES = {
  'it-related': 'IT-Related Device Repair',
  'phone-repair': 'Phone Repair',
  automotive: 'Automotive Services',
  'home-repair': 'Home Repair Services',
};

// POST /api/providers/apply (multipart). Field names match provider_controllers.js / provider_routes.js.
// `step1` is the router state from ServiceCategory.jsx, `files` the images from VerificationRequirements.jsx.
export const submitProviderApplication = (step1, files) => {
  const body = new FormData();
  body.append(
    'selectedCategories',
    JSON.stringify((step1.categories || []).map((key) => CATEGORY_NAMES[key] ?? key))
  );
  body.append(
    'homeRepairServices',
    JSON.stringify((step1.homeRepairServices || []).map((service) => service.name))
  );
  body.append('otherServices', JSON.stringify(step1.services || []));
  body.append('yearsOfExperience', String(step1.yearsOfExperience));
  body.append('offersHomeServices', step1.offersHomeService ? 'yes' : 'no');
  body.append('validId', files.validId);
  body.append('selfie', files.selfie);
  files.supportingDocs.forEach((f) => body.append('supportingDocs', f));
  return request('/providers/apply', { method: 'POST', body });
};

// Choices for the "Services" dropdown on the Service Category screen (home repair).
// Expected: [{ id, name }], ['Plumbing', ...] or { services: [...] }. The screen falls back to
// a default list when this fails, so the endpoint is optional.
export const getHomeRepairServices = () =>
  request('/service-categories/home-repair/services');

// --- Service provider availability (the calendar on the provider dashboard) ---
// Expected backend routes (add them to provider_routes.js / provider_controllers.js):
//   GET  /api/providers/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
//        -> { availability: { 'YYYY-MM-DD': { '10:00 AM': 'unavailable' } } }
//           (the bare map is accepted too). Dates/slots that are missing are available.
//   PUT  /api/providers/availability   body: { date: 'YYYY-MM-DD', slot: '10:00 AM', status: 'unavailable' }
// The provider is identified from the login token, like the other provider routes.
export const getProviderAvailability = async ({ from, to } = {}) => {
  const data = await request(
    `/providers/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
  return data?.availability ?? data ?? {};
};

export const setProviderAvailability = ({ date, slot, status }) =>
  request('/providers/availability', { method: 'PUT', body: { date, slot, status } });

// --- Admin: user management ---
export const getAdminUsers = ({ tab = 'all', page = 1, pageSize = 5 } = {}) =>
  request(`/admin/users?tab=${encodeURIComponent(tab)}&page=${page}&pageSize=${pageSize}`);
export const approveProvider = (id) => request(`/admin/users/${id}/approve`, { method: 'PATCH' });
export const rejectProvider = (id, reason) =>
  request(`/admin/users/${id}/reject`, { method: 'PATCH', body: { reason } });
export const disableUser = (id) => request(`/admin/users/${id}/disable`, { method: 'PATCH' });
export const enableUser = (id) => request(`/admin/users/${id}/enable`, { method: 'PATCH' });
export const getProviderDocuments = (id, kind) => request(`/admin/users/${id}/documents/${kind}`);

// --- Service requests: customer side (backend: /api/service-requests, see servicerequest_routes.js) ---

// Step 1 of the create-request flow. `formData` is multipart: category, description,
// photo?, appointmentDate? ("YYYY-MM-DD"), appointmentTime? ("10:00 AM"), latitude?, longitude?.
// Creates a draft (request_status 'New') -> { request: { id: "SR-0007", ... } }.
export const createServiceRequest = (formData) =>
  request('/service-requests', { method: 'POST', body: formData });

// The customer's own requests (Track Requests / History) -> { requests: [...] }.
export const getMyServiceRequests = () => request('/service-requests');

// One of the customer's own requests -> { request: {...} }.
export const getServiceRequest = (requestId) =>
  request(`/service-requests/${encodeURIComponent(requestId)}`);

// Runs the AI diagnosis once and saves it; calling again returns the saved result.
// -> { diagnosis: { probableCause, confidencePercent, relatedChecks, troubleshootingSuggestions } }
export const runAiDiagnosis = (requestId) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/ai-diagnosis`, { method: 'POST' });

// "Skip AI and Find Service Providers" -> { request: {...} }.
export const skipAiDiagnosis = (requestId) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/skip-ai`, { method: 'POST' });

// The AI solved the problem; closes the draft request -> { request: {...} }.
export const resolveServiceRequest = (requestId) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/resolve`, { method: 'POST' });

// Verified providers for this request, category matches first -> { providers: [...] }.
export const getRecommendedProviders = (requestId) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/providers`);

// Sends the request to the chosen providers (max 5); it shows up in their
// Incoming Service Requests list -> { request: {...} }.
export const submitServiceRequest = (requestId, providerIds) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/submit`, {
    method: 'POST',
    body: { providerIds },
  });

// --- Draft request id ---
// The create-request flow spans several routes (CreateServiceRequest -> AIDiagnosis_Skip ->
// AIResult -> RecommendServiceProvider -> SubmitServiceRequest). The draft's id (e.g. "SR-0007")
// is kept here between steps. sessionStorage survives a page refresh but not a new tab.
const DRAFT_REQUEST_KEY = 'draftRequestId';
export const setDraftRequestId = (id) => sessionStorage.setItem(DRAFT_REQUEST_KEY, id);
export const getDraftRequestId = () => sessionStorage.getItem(DRAFT_REQUEST_KEY);
export const clearDraftRequestId = () => sessionStorage.removeItem(DRAFT_REQUEST_KEY);

// --- Service requests: provider side (backend: /api/providers/requests) ---

// Incoming Service Requests list -> { requests: [...] } (shape of IncomingServiceRequest.jsx).
export const getProviderServiceRequests = () => request('/providers/requests');

// Request details -> { request: {...} } (shape of ServiceRequestDetails.jsx).
export const getProviderServiceRequest = (requestId) =>
  request(`/providers/requests/${encodeURIComponent(requestId)}`);

// Approve = send the pre-repair quotation -> { request: {...} }.
export const sendQuote = (requestId, { laborPrice, itemPrice, notes } = {}) =>
  request(`/providers/requests/${encodeURIComponent(requestId)}/quote`, {
    method: 'POST',
    body: { laborPrice, itemPrice, notes },
  });

// Decline the request (reason is required by the backend) -> { ok: true }.
export const rejectServiceRequest = (requestId, { reason } = {}) =>
  request(`/providers/requests/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
    body: { reason },
  });