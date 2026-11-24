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

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch (networkErr) {
    // fetch itself only throws on network/CORS failures — never on HTTP errors.
    // Give a readable message instead of the browser's cryptic "Failed to fetch".
    const err = new Error('Cannot reach the server. It may be starting up — please wait a moment and try again.');
    err.status = 0;
    err.cause = networkErr;
    throw err;
  }

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

// Step 1 of signup (SendOTP.jsx): the backend sends a 6-digit code to the chosen channel.
// channel: 'sms' (-> phone_number) | 'email' (-> email). Defaults to 'sms' so older callers keep working.
// May resolve { message, destination } where destination is the masked phone/email.
export const requestOtp = (form, channel = 'sms') =>
  request('/auth/request-otp', {
    method: 'POST',
    body: { ...toRegistrationPayload(form), otp_channel: channel },
    auth: false,
  });

// Step 2 of signup (OTPVerification.jsx): the code is checked against the one sent on `channel`.
export const register = async (form, otp, channel = 'sms') => {
  const data = await request('/auth/register', {
    method: 'POST',
    body: { ...toRegistrationPayload(form), otp, otp_channel: channel },
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

// Update the signed-in customer's account details and return the updated user.
export const updateProfile = async ({ name, email, address }) => {
  const data = await request('/users/me', {
    method: 'PATCH',
    body: { name, email, address },
  });
  return data.user;
};

// Upload the signed-in customer's profile photo -> { photoUrl } (signed URL).
export const uploadUserPhoto = (file) => {
  const body = new FormData();
  body.append('photo', file);
  return request('/users/me/photo', { method: 'POST', body });
};

// --- Forgot password flow (Forgot Password -> OTP -> New Password) ---
// Mirrors ServEaseMobile/api/passwordReset.js; same endpoints and payload shapes.
// Step 1: backend emails a one-time code. Resolves { message, resendAfter }.
// (Answers the same way for unknown emails, so addresses can't be probed.)
export const forgotPassword = (email) =>
  request('/auth/forgot-password', {
    method: 'POST',
    body: { email: email.trim().toLowerCase() },
    auth: false,
  });

// Step 2: backend checks the code. Resolves { resetToken, expiresIn }.
export const verifyResetOtp = (email, otp) =>
  request('/auth/verify-reset-otp', {
    method: 'POST',
    body: { email: email.trim().toLowerCase(), otp },
    auth: false,
  });

// Step 3: backend saves the new password. Resolves { message }.
// The backend looks the reset token up by email, so email is required too.
export const resetPassword = (email, resetToken, password) =>
  request('/auth/reset-password', {
    method: 'POST',
    body: { email: email.trim().toLowerCase(), resetToken, password },
    auth: false,
  });

// Google sign-in: the custom gradient button on Login.jsx uses useGoogleLogin
// (implicit popup flow), which hands us a Google ACCESS token; the backend verifies
// it and replies with the same payload shape as /auth/login, plus needs_phone for
// brand-new accounts.
export const loginWithGoogle = async (accessToken) => {
  const data = await request('/auth/google', {
    method: 'POST',
    body: { access_token: accessToken },
    auth: false,
  });
  setToken(data.token);
  return { user: data.user, provider: data.provider, needsPhone: !!data.needs_phone };
};

// Complete-profile flow (Google users have no phone number yet): request an OTP,
// then verify it to attach the phone to the logged-in account.
export const requestPhoneOtp = (phone) =>
  request('/auth/phone/request-otp', { method: 'POST', body: { phone_number: phone } });

export const verifyPhoneOtp = async (phone, otp) => {
  const data = await request('/auth/phone/verify', {
    method: 'POST',
    body: { phone_number: phone, otp },
  });
  return data.user;
};
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
//   PUT  /api/providers/availability   body: { date: 'YYYY-MM-DD', slot: '10:00 AM', status: 'unavailable' | 'available' }
//        'unavailable' saves the block; 'available' removes it again (so the slot is open to customers).
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

// --- Admin: reports and errors (admin/ReportsAndErrors.jsx) ---
// tab: 'all' | 'user' | 'system' | 'resolved'. Resolves { reports, total }.
export const getAdminReports = ({ tab = 'all', search = '', page = 1, pageSize = 5 } = {}) => {
  const params = new URLSearchParams({ tab, page: String(page), pageSize: String(pageSize) });
  if (search) params.set('search', search);
  return request(`/admin/reports?${params.toString()}`);
};
// One report incl. fresh image URLs -> { report }
export const getAdminReport = (id) => request(`/admin/reports/${id}`);
// status: 'resolved' | 'dismissed'; admin_note is optional text saved with the report.
export const updateAdminReportStatus = (id, { status, admin_note }) =>
  request(`/admin/reports/${id}/status`, { method: 'PATCH', body: { status, admin_note } });

// --- Service requests: customer side (backend: /api/service-requests, see servicerequest_routes.js) ---

// What the "Creating Service Request" form offers, so none of it is hard-coded in the screen:
// -> {
//      categories:       [{ value, label }],   // `value` is sent back as `category`
//      locationTypes:    [{ value, label }],   // e.g. 'home' / 'shop', sent as `serviceLocationType`
//      timeSlots:        ['10:00 AM', ...],    // appointment times offered
//      searchRadius:     { minKm, maxKm, defaultKm },
//      defaultMapCenter: { lat, lng },         // optional: where the map opens until the location resolves
//      uploadLimits:     { maxImages, maxVideos, maxImageMb, maxVideoMb },  // optional
//    }
// Register this route BEFORE '/:requestId' in servicerequest_routes.js (like '/active' and '/tracking').
export const getServiceRequestOptions = () => request('/service-requests/options');

// Appointment slots for ONE day, with the ones that can no longer be booked marked unavailable
// -> { slots: [{ time: '9:00 AM', available: true }, ...] }.
// category / latitude / longitude / radiusKm are sent when the customer already picked them, so the
// backend can decide availability for the providers that could actually take this request.
// Register this route BEFORE '/:requestId' in servicerequest_routes.js.
export const getAppointmentSlots = ({ date, category, latitude, longitude, radiusKm } = {}) => {
  const params = new URLSearchParams({ date });
  if (category) params.set('category', category);
  if (latitude != null) params.set('latitude', latitude);
  if (longitude != null) params.set('longitude', longitude);
  if (radiusKm != null) params.set('radiusKm', radiusKm);
  return request(`/service-requests/time-slots?${params.toString()}`);
};

// Step 1 of the create-request flow. `formData` is multipart: category, description,
// serviceLocationType?, photos? (up to 4 image files, repeat the field), video? (1 video file),
// appointmentDate? ("YYYY-MM-DD"), appointmentTime? ("9:00 AM"), latitude?, longitude?, searchRadiusKm?.
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

// The customer pressed the close button and answered "No": delete the unsubmitted draft so the
// request is not recorded -> { ok: true }. Only drafts (not yet submitted) may be deleted.
export const cancelDraftRequest = (requestId) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/draft`, { method: 'DELETE' });

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
// `filter=everything` also returns the closed ones (declined by this provider / quotation declined by the
// customer); the web list filters New / Pending / Closed on its own.
export const getProviderServiceRequests = () => request('/providers/requests?filter=everything');

// Service categories (public) -> { categories: [{ key, label, specializationNames }] }.
// Feeds the Categories dropdowns on Incoming Service Requests and Active Jobs.
export const getServiceCategories = () => request('/categories', { auth: false });

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

// --- Customer: dashboard + Track Requests (backend: workflow_controllers.js) ---

// The dashboard's "Active Repair" box -> { activeRepair } (activeRepair is null when none).
export const getActiveRepair = () => request('/service-requests/active');

// One call feeds the whole Track Requests screen: cards grouped by tab.
// -> { sent: [...], approved: [...], ongoing: [...], declined: [...], done: [...] }
// Card shapes (all carry requestId/requestNumber/providerId/providerName):
//   cardType 'diagnosis' : probableCause, confidencePercent
//   cardType 'quotation' : laborCost, partsCost, total, notes
//   cardType 'schedule'  : proposalId, scheduledAt, reason
//   cardType 'payment'   : paymentRequestId, paymentAmount, paymentReason
//   cardType 'timeline'  : total, timeline: [{ label, timestamp, description, done }]
//   cardType 'completed' : finalAmount, timeline
//   cardType 'declined'  : reason
export const getTrackingCards = () => request('/service-requests/tracking');

// View Repair Details: every step with the provider's updates (time, notes, photos / videos).
// -> { requestNumber, providerName, serviceLocationType, statusLabel, isPaid,
//      steps: [{ key, label, done, updatedAt, updates: [{ id, updatedAt, notes,
//               attachments: [{ id, url, type: 'image' | 'video', name }] }] }] }
export const getRepairDetails = (requestId) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/repair-details`);

// Answer a provider's proposed schedule. answer: 'accept' | 'reject' -> { ok, status }.
export const answerScheduleProposal = (requestId, proposalId, answer) =>
  request(
    `/service-requests/${encodeURIComponent(requestId)}/schedule-proposals/${encodeURIComponent(proposalId)}/${answer}`,
    { method: 'POST' }
  );

// Answer an additional-payment request. answer: 'approve' | 'reject' -> { ok, status }.
export const answerPaymentRequest = (requestId, paymentRequestId, answer) =>
  request(
    `/service-requests/${encodeURIComponent(requestId)}/payment-requests/${encodeURIComponent(paymentRequestId)}/${answer}`,
    { method: 'POST' }
  );

// Counter-offer on an additional payment (Negotiate modal on Track). The request stays pending.
// body: { proposedAmount?: number, message?: string } -> { ok, status, proposedAmount }.
export const negotiatePaymentRequest = (requestId, paymentRequestId, { proposedAmount, message } = {}) =>
  request(
    `/service-requests/${encodeURIComponent(requestId)}/payment-requests/${encodeURIComponent(paymentRequestId)}/negotiate`,
    { method: 'POST', body: { proposedAmount, message } }
  );

// Approve/decline a provider's quotation (MyRequestDetails.jsx) -> { ok, status }.
export const respondToQuotation = (requestId, approve) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/quotation/respond`, {
    method: 'POST',
    body: { approve },
  });

// Server-computed amounts so the browser cannot tamper with them
// -> { total, paid, due: { initial, additional, final } }.
export const getPaymentDue = (requestId) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/payment-due`);

// Start a payment. stage: 'initial' | 'additional' | 'final', method: 'gcash' | 'qrph' | 'card'.
// -> { payment, checkoutUrl? } — with PayMongo keys configured, redirect the browser to
// checkoutUrl; without them (dev mode) the payment is recorded as paid immediately.
export const payForRequest = (requestId, { amount, method, stage }) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/payment`, {
    method: 'POST',
    body: { amount, method, stage },
  });

// Poll after returning from the PayMongo checkout page -> { payment: { status, ... } }.
export const getPaymentStatus = (requestId) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/payment-status`);

// Rate a completed request (Rating.jsx). 409 when already rated -> { rating }.
export const rateRequest = (requestId, { rating, review }) =>
  request(`/service-requests/${encodeURIComponent(requestId)}/rating`, {
    method: 'POST',
    body: { rating, review },
  });

// Customer History screen. type: 'all' | 'repair' | 'transactions' -> { items: [...] }.
export const getCustomerHistory = (type = 'all') =>
  request(`/service-requests/history?type=${encodeURIComponent(type)}`);

// --- Notifications (bell + dashboard boxes) ---

// -> { notifications: [{ id, type, message, requestId, readAt, createdAt }] }
// `audience` ('customer' | 'provider') selects that side's notifications on the backend. Admin is
// intentionally unfiltered because the backend has no admin audience.
export const getNotifications = (audience) =>
  request(`/notifications${audience ? `?audience=${encodeURIComponent(audience)}` : ''}`);

export const markNotificationRead = (notificationId) =>
  request(`/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST' });

// The logged-in provider's own profile. photoUrl is a signed URL for
// service_providers.profile_photo (the photo uploaded through the provider profile editor).
export const getMyProviderProfile = () => request('/providers/me/profile');

// Provider Edit Profile (ServiceProviderEditProfile.jsx). Send only the fields that changed:
// { email, address, availabilityDays: ['Mon', ...], availabilityHours: '9:00 AM - 5:00 PM' | null,
//   companyName, companyAddress }. Resolves the updated profile (same shape as getMyProviderProfile).
export const updateMyProviderProfile = (changes) =>
  request('/providers/me/profile', { method: 'PATCH', body: changes });

// Upload a new provider profile photo (multipart field "photo") -> { photoUrl } (signed URL).
export const uploadProviderPhoto = (file) => {
  const body = new FormData();
  body.append('photo', file);
  return request('/providers/me/photo', { method: 'POST', body });
};

// --- Browse service providers (Find Service Providers / provider profile) ---

// -> { providers: [{ id, name, specialty, specialities, verified, available, rating,
//      reviewCount, experienceYears, locationName, availabilitySchedule, photoUrl }] }
export const browseServiceProviders = ({ search, category, available } = {}) => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (available) params.set('available', 'true');
  const qs = params.toString();
  return request(`/service-providers${qs ? `?${qs}` : ''}`);
};

// One provider's full profile + masked reviews -> { provider: {...} }.
export const getServiceProviderDetails = (providerId) =>
  request(`/service-providers/${encodeURIComponent(providerId)}`);

// --- Messaging (one conversation per service request; the id IS the request ref "SR-0007") ---

// -> { conversations: [{ id, participantId, name, avatarUrl, lastMessage, hasUnread, jobTitle, isOnline }] }
export const getConversations = () => request('/conversations');

// Full history, oldest first; also marks the thread read for the viewer
// -> { messages: [{ id, text, sender: 'customer' | 'provider', senderId, createdAt }] }.
export const getConversationMessages = (conversationId) =>
  request(`/conversations/${encodeURIComponent(conversationId)}/messages`);

// -> { message: {...} }.
export const sendConversationMessage = (conversationId, text) =>
  request(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: { text },
  });

// --- Service provider: jobs + earnings (backend: providerwork_routes.js) ---

// Active Jobs list -> { jobs: [{ id, requestNumber, customerName, createdAt, status,
//   aiSuggestion, aiConfidence, stages, currentStepIndex, currentStepLabel,
//   progressPaymentPaid, paidTotal }] }.
export const getProviderJobs = () => request('/provider/jobs');

// Push a status update (multipart when files are attached). stage must be one of the job's
// `stages`. files = up to 5 photos / videos (File[]); the backend saves them with the update and
// the customer sees them in Track Requests > View (getRepairDetails).
export const updateProviderJobStatus = (jobId, { stage, notes, files = [] } = {}) => {
  const body = new FormData();
  body.append('stage', stage);
  if (notes) body.append('notes', notes);
  files.forEach((file) => body.append('attachments', file));
  return request(`/provider/jobs/${encodeURIComponent(jobId)}/status`, {
    method: 'PATCH',
    body,
  });
};

// Ask the customer for an additional-parts payment -> { paymentRequest }.
export const notifyAdditionalParts = (jobId, { additionalCost, notes } = {}) =>
  request(`/provider/jobs/${encodeURIComponent(jobId)}/additional-parts`, {
    method: 'POST',
    body: { additionalCost, notes },
  });

// Price negotiations from customers (Active Jobs > Quotation) -> { quotations: [{ paymentRequestId, jobId,
//   requestNumber, customerName, createdAt, category, distanceKm, originalAmount, proposedAmount,
//   customerMessage, providerNotes }] }.
export const getProviderJobQuotations = () => request('/provider/jobs/quotations');

// Accept the customer's suggested amount: the additional payment becomes that amount -> { ok, status, amount }.
export const acceptJobNegotiation = (jobId, paymentRequestId) =>
  request(
    `/provider/jobs/${encodeURIComponent(jobId)}/payment-requests/${encodeURIComponent(paymentRequestId)}/negotiation/accept`,
    { method: 'POST' }
  );

// Decline the customer's suggested amount (reason required) -> { ok, status }.
export const rejectJobNegotiation = (jobId, paymentRequestId, { reason } = {}) =>
  request(
    `/provider/jobs/${encodeURIComponent(jobId)}/payment-requests/${encodeURIComponent(paymentRequestId)}/negotiation/reject`,
    { method: 'POST', body: { reason } }
  );

// Earnings screen -> { summary: { thisWeek, pendingPayment }, transactions: [{ id,
//   requestNumber, customerName, date, amount }] }.
export const getProviderEarnings = () => request('/provider/earnings');

// Provider dashboard (stat cards, pending requests, notifications, active repair)
// -> { stats: { activeJobs, jobsThisMonth, rating }, activeRepair: {...} | null,
//      notifications: [{ id, message, createdAt }], pendingRequests: [{ id, requestNumber, customerName }] }.
export const getProviderDashboard = () => request('/provider/dashboard');

// --- Report a Problem (CustomerProfile / ServiceProviderProfile) ---
// Sends the Report a Problem form to POST /api/reports (multipart).
// type: 'system_error' | 'user'; reportedFrom: 'customer' | 'serviceprovider';
// reportedUsername is only for type 'user' (the username of the one being reported).
// The reporter is taken from the login token on the server. Resolves { message, report }.
export const submitReport = ({ type, reportedFrom, subject, details, reportedUsername, images = [] }) => {
  const body = new FormData();
  body.append('type', type);
  body.append('reportedFrom', reportedFrom);
  body.append('subject', subject);
  body.append('details', details);
  if (reportedUsername) body.append('reportedUsername', reportedUsername);
  images.forEach((file) => body.append('images', file));
  return request('/reports', { method: 'POST', body });
};