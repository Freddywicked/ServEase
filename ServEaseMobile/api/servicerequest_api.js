// ADAPT #1 done: client.js exports the base URL as API_BASE_URL (there is no BASE_URL export).
// ADAPT #2 done: client.js stores the login JWT under AsyncStorage key 'token'; its getToken()
// reads exactly that, so reuse it instead of guessing an 'accessToken' key.
import { API_BASE_URL as BASE_URL, getToken } from './client';

/* ============================================================================
 * serviceRequestApi — every backend call used by the Create Service Request flow
 * ----------------------------------------------------------------------------
 * ADAPT #1  BASE_URL comes from api/client.js (the backend says its port "must match BASE_URL in the
 *           mobile app's api/client.js"). The server prints its addresses WITH the /api suffix
 *           (e.g. http://10.0.2.2:5000/api), so BASE_URL most likely already ends in /api and
 *           API_PREFIX below is ''. If it is the bare host instead, set API_PREFIX = '/api'.
 *           If client.js does not `export` BASE_URL yet, add the export.
 * ADAPT #2  getAccessToken() must return the JWT /api/auth/login issued. client.js already
 *           stores/clears that token (it has the 401 handling), so import its token getter here
 *           instead of the AsyncStorage guess below once you've confirmed its name.
 *
 * Conventions this layer follows (taken from the existing backend):
 *   - Auth: `Authorization: Bearer <JWT>` (middleware/auth.js).
 *   - Errors: non-2xx with JSON { message, details?, error: { message } } (errorHandler.js).
 *   - Requests: camelCase bodies, as the server already reads (activeMode, selectedCategories ...).
 *   - Responses: the server returns snake_case (verification_status, years_of_experience) in some
 *     places and camelCase in others (the admin routes), so every response is converted to
 *     camelCase here — screens only ever see camelCase.
 *   - Responses are objects keyed by resource, e.g. { provider }, { users, total }, { application }.
 *     New endpoints below follow that ({ categories }, { providers }, { notifications } ...);
 *     `pick('key')` unwraps it and also accepts a bare array/object.
 *
 * ENDPOINTS USED
 *   GET  /categories                       -> { categories: [{ key, label, specializationNames[] }] }
 *   GET  /appointment-time-slots           -> { timeSlots: [{ value: 'HH:mm', label: '8:00 AM' }] }
 *   POST /service-requests/photos          (multipart, field "photo", images only, 5 MB) -> { photo: { path } }
 *   GET  /location/reverse-geocode         ?latitude&longitude -> { address, mapImageUri }
 *   POST /service-requests/diagnose        -> { probableCause, confidence, tags[], troubleshootingSteps[], lowConfidence? }
 *   GET  /service-providers/recommended    -> [provider]   (shape documented below)
 *   POST /service-requests                 -> { requestId, requestStatus }
 *   GET  /service-requests/active          -> { requestId, requestStatus, statusLabel, providerName } | 404/204 if none
 *   GET  /notifications                    ?limit -> [{ id, message, createdAt }]
 *
 * TRACKING (Track screen — customer side)
 *   GET  /service-requests/tracking                          -> { sent[], approved[], ongoing[], declined[], done[] } cards
 *   POST /service-requests/:id/schedule-proposals/:pid/accept | /reject
 *   POST /service-requests/:id/payment-requests/:pid/approve  | /reject
 *
 *   POST /service-requests/:id/quotation/respond  { approve }   (RequestDetails.js)
 *
 * PROVIDER-SIDE ENDPOINTS (the other half of the same SERVICE_REQUEST)
 *   GET  /provider/dashboard                       -> { stats, activeRepair, notifications, pendingRequests }
 *   GET  /provider/service-requests                ?filter=all|new|pending -> [incomingRequest]
 *   GET  /provider/service-requests/:id            -> incomingRequest (+ description, photoUrl, location)
 *   POST /provider/service-requests/:id/accept     -> { requestId, requestStatus }
 *   POST /provider/service-requests/:id/decline    { reason? }
 *   POST /provider/service-requests/:id/quotation  { laborCost, partsCost, remarks }
 *   POST /provider/service-requests/:id/schedule-proposals   { scheduledAt, reason }
 *   POST /provider/service-requests/:id/payment-requests     { amount, reason }
 *   POST /provider/service-requests/:id/progress             { step }
 *   POST /provider/service-requests/:id/complete
 *   POST /provider/service-requests/:id/schedule-proposals  { scheduledAt, reason }
 *   POST /provider/service-requests/:id/payment-requests    { amount, reason }
 *   POST /provider/service-requests/:id/progress            { step }
 *   POST /provider/service-requests/:id/complete
 * ========================================================================== */

const API_PREFIX = ''; // see ADAPT #1
const API_BASE_URL = `${BASE_URL}${API_PREFIX}`;
const DEFAULT_TIMEOUT_MS = 15000;
// AI language-model call: expect higher latency. 60s because the deployed backend
// (Render free tier) can cold-start for tens of seconds BEFORE Gemini even runs.
const DIAGNOSIS_TIMEOUT_MS = 60000;

const getAccessToken = getToken;

const toCamelCase = (key) => key.replace(/_([a-z0-9])/g, (match, char) => char.toUpperCase());

const camelizeKeys = (value) => {
    if (Array.isArray(value)) return value.map(camelizeKeys);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, inner]) => [toCamelCase(key), camelizeKeys(inner)]));
    }
    return value;
};

// Unwraps { key: ... } responses; passes through anything that isn't wrapped that way.
const pick = (key) => (data) => (data && !Array.isArray(data) && data[key] !== undefined ? data[key] : data);

export class ApiError extends Error {
    constructor(message, { status = 0, code = null } = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

const buildQuery = (query) => {
    if (!query) return '';
    const parts = Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => {
            const text = Array.isArray(value) ? value.join(',') : String(value);
            return `${encodeURIComponent(key)}=${encodeURIComponent(text)}`;
        });
    return parts.length ? `?${parts.join('&')}` : '';
};

export const request = async (path, { method = 'GET', query, body, formData, headers, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) => {
    const token = await getAccessToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', () => controller.abort());
    }

    try {
        const response = await fetch(`${API_BASE_URL}${path}${buildQuery(query)}`, {
            method,
            headers: {
                Accept: 'application/json',
                ...(body ? { 'Content-Type': 'application/json' } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...headers,
            },
            body: formData || (body ? JSON.stringify(body) : undefined),
            signal: controller.signal,
        });

        const payload = response.status === 204 ? null : await response.json().catch(() => null);
        if (!response.ok) {
            // errorHandler sends { message, details? }. For validation errors `details` holds the
            // per-field messages (see validators.js), which read better in an alert than the
            // generic "Please fix the highlighted fields".
            const details = payload?.details ?? payload?.error?.details;
            const detailMessages =
                details && typeof details === 'object'
                    ? Object.values(details).filter((value) => typeof value === 'string')
                    : [];
            throw new ApiError(detailMessages.length ? detailMessages.join('\n') : payload?.message || `Request failed (${response.status})`, {
                status: response.status,
                code: payload?.code ?? null,
            });
        }
        return camelizeKeys(payload && payload.data !== undefined ? payload.data : payload);
    } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error.name === 'AbortError') {
            throw new ApiError('The request timed out. Please try again.', { code: 'TIMEOUT' });
        }
        throw new ApiError('Network error. Check your connection and try again.', { code: 'NETWORK' });
    } finally {
        clearTimeout(timer);
    }
};

/* ----------------------------- Step 1: collect ----------------------------- */

// Whatever `key` values come back are written straight to SERVICE_REQUEST.category and
// must match SERVICE_PROVIDER_SPECIALIZATION so providers can be matched to it.
export const getCategories = () => request('/categories').then(pick('categories'));

// The customer's *preferred* slots (not a provider's real availability — no provider is chosen yet).
export const getAppointmentTimeSlots = () => request('/appointment-time-slots').then(pick('timeSlots'));

// Uploads to the Supabase Storage bucket (e.g. `service-request-photos`) server-side and
// returns the stored URL — that URL, not the local file URI, is what gets saved on the request.
export const uploadServiceRequestPhoto = (asset) => {
    const formData = new FormData();
    formData.append('photo', {
        uri: asset.uri,
        name: asset.fileName || `photo-${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
    });
    return request('/service-requests/photos', { method: 'POST', formData, timeoutMs: 60000 }).then(pick('photo'));
};

// Reverse-geocodes on the backend so the Google Maps key never ships inside the app.
export const reverseGeocode = ({ latitude, longitude }) =>
    request('/location/reverse-geocode', { query: { latitude, longitude } }).then(pick('location'));

/* ---------------------------- Step 2: AI diagnosis ---------------------------- */

// No SERVICE_REQUEST row is created by this call — it is persisted later, on submit.
export const diagnoseServiceRequest = (draft, { signal } = {}) =>
    request('/service-requests/diagnose', {
        method: 'POST',
        body: {
            category: draft.categoryKey,
            description: draft.description.trim(),
            photoPath: draft.photoPath,
            latitude: draft.location?.latitude ?? null,
            longitude: draft.location?.longitude ?? null,
        },
        timeoutMs: DIAGNOSIS_TIMEOUT_MS,
        signal,
    }).then(pick('diagnosis'));

/* ----------------------- Step 3: matching service providers ----------------------- */

/**
 * Provider shape expected back (each field maps to the table noted):
 * {
 *   id, name,                      // USER.name
 *   photoUrl,                      // optional
 *   specialty,                     // primary SERVICE_PROVIDER_SPECIALIZATION.specialization_name
 *   specialties: string[],         // all SERVICE_PROVIDER_SPECIALIZATION.specialization_name
 *   verified: boolean,             // SERVICE_PROVIDER.verification_status === 'verified'
 *   available: boolean,            // SERVICE_PROVIDER.availability (right now)
 *   availabilitySchedule: string,  // e.g. 'Mon-Fri, 8AM-6PM'
 *   rating: number|null,           // avg of RATING for this provider
 *   reviewCount: number,
 *   experienceYears: number|null,  // SERVICE_PROVIDER.experience
 *   locationName: string,          // e.g. 'Naga City'
 *   distanceKm: number|null,       // computed server-side from lat/long
 * }
 * Sorting/matching (specialization, ratings/sentiment, distance, and the customer's
 * preferred date/time) is the backend's job. `exclude` = ids already shown.
 */
export const getRecommendedProviders = ({ categoryKey, latitude, longitude, preferredDate, preferredTime, exclude }) =>
    request('/service-providers/recommended', {
        query: { category: categoryKey, latitude, longitude, preferredDate, preferredTime, exclude },
    }).then(pick('providers'));

/* --------------------------- Steps 3/2: create the request --------------------------- */

// Creates the SERVICE_REQUEST row.
//   - extra.providerId   -> customer picked a provider; backend sets request_status
//                           'pending_quotation' and notifies that provider (see the
//                           PROVIDER COMMUNICATION block at the bottom of this file).
//   - extra.resolvedByAi -> customer solved it from the AI suggestions; backend sets
//                           request_status 'resolved_self_ai' and no provider is assigned.
// Idempotent: a retry with the same Idempotency-Key / clientRequestId (e.g. the first call succeeded
// but the response was lost) must return the EXISTING request, not a 409 — otherwise the app can't
// tell it apart from the real 409 below (provider no longer available). db.js's unwrap() turns a
// unique-constraint hit into 409 'That record already exists', so look the row up first.
// The backend decides the status — the app never sends a status string.
// `aiDiagnosis` is sent as an object: store it as jsonb in SERVICE_REQUEST.ai_diagnosis.
export const createServiceRequest = (draft, extra = {}) =>
    request('/service-requests', {
        method: 'POST',
        headers: { 'Idempotency-Key': draft.clientRequestId },
        body: {
            clientRequestId: draft.clientRequestId,
            category: draft.categoryKey,
            description: draft.description.trim(),
            photoPath: draft.photoPath,
            latitude: draft.location?.latitude ?? null,
            longitude: draft.location?.longitude ?? null,
            address: draft.location?.address ?? null,
            preferredDate: draft.preferredDate,
            preferredTime: draft.preferredTime,
            aiDiagnosis: draft.aiDiagnosis,
            providerId: extra.providerId ?? draft.providerId ?? null,
            resolvedByAi: Boolean(extra.resolvedByAi),
        },
    });

/* ------------------------------ Customer dashboard ------------------------------ */

export const getActiveRepair = async () => {
    try {
        return pick('activeRepair')(await request('/service-requests/active'));
    } catch (error) {
        // 404 can mean "no active repair" OR "this route doesn't exist yet" (server.js answers
        // `Cannot GET /api/...`). Only the first is an empty state; the second should surface.
        // Cleanest is for the backend to answer 200 { activeRepair: null }, which pick() handles.
        if (error.status === 404 && !/^(Cannot |Route not found)/.test(error.message)) return null;
        throw error;
    }
};

export const getNotifications = ({ limit } = {}) => request('/notifications', { query: { limit } }).then(pick('notifications'));

/* ------------------------------ Tracking (customer) ------------------------------ */

/**
 * One call feeds the whole Track screen. Each request can produce more than one card
 * (e.g. a quotation AND a new-schedule proposal), so the backend returns CARDS grouped
 * by tab. Everything on a card comes from one of two places:
 *   - the customer's own SERVICE_REQUEST (description, AI diagnosis, request number), and
 *   - what the SERVICE PROVIDER has done to it (quotation, proposed schedule, extra
 *     payment request, progress steps, completion, decline).
 *
 * Shape: { sent: [card], approved: [card], ongoing: [card], declined: [card], done: [card] }
 *
 * Every card:  { id (unique per card), requestId, requestNumber, providerId, providerName, cardType }
 *   cardType 'diagnosis' (sent):      probableCause|null, confidencePercent|null
 *   cardType 'quotation' (approved):  laborCost, partsCost, total            <- provider's QUOTATION
 *   cardType 'schedule'  (approved):  proposalId, scheduledAt (ISO), reason  <- provider's new schedule
 *   cardType 'payment'   (ongoing):   paymentRequestId, paymentAmount, paymentReason <- provider's extra charge
 *   cardType 'timeline'  (ongoing):   timeline: [{ label, timestamp (ISO)|null, description?, done }]
 *   cardType 'completed' (done):      finalAmount, timeline
 *   cardType 'declined'  (declined):  reason|null                            <- provider's decline reason
 */
export const getTrackedRequests = () => request('/service-requests/tracking');

// Customer answers a provider's proposed new schedule. Backend updates the appointment (accept)
// or keeps the old one (reject), notifies the provider and returns 409 if it's no longer open.
export const acceptScheduleProposal = (requestId, proposalId) =>
    request(`/service-requests/${requestId}/schedule-proposals/${proposalId}/accept`, { method: 'POST' });
export const rejectScheduleProposal = (requestId, proposalId) =>
    request(`/service-requests/${requestId}/schedule-proposals/${proposalId}/reject`, { method: 'POST' });

// Customer answers a provider's request for additional payment. Backend notifies the provider.
export const approveAdditionalPayment = (requestId, paymentRequestId) =>
    request(`/service-requests/${requestId}/payment-requests/${paymentRequestId}/approve`, { method: 'POST' });
export const rejectAdditionalPayment = (requestId, paymentRequestId) =>
    request(`/service-requests/${requestId}/payment-requests/${paymentRequestId}/reject`, { method: 'POST' });

// Customer approves / declines the provider's quotation (used by RequestDetails.js, which is
// where the quotation card on Track.js leads). Backend notifies the provider; 409 if no longer open.
export const respondToQuotation = (requestId, { approve }) =>
    request(`/service-requests/${requestId}/quotation/respond`, { method: 'POST', body: { approve } });

// The customer's submitted requests, newest first (History screen). Same endpoint the
// web app uses; each entry is the toCustomerDto shape (id, status, category, providers...).
export const getMyServiceRequests = () => request('/service-requests').then(pick('requests'));

// One of the customer's own requests (RequestDetails.js) -> the toCustomerDto shape.
export const getServiceRequest = (requestId) => request(`/service-requests/${requestId}`).then(pick('request'));

// Starts a payment for the request (Payment.js). method: 'gcash' | 'qrph' | 'card',
// stage: 'initial' | 'final' | 'additional'. When the backend has PayMongo keys this
// returns { payment, checkoutUrl } — open checkoutUrl in the browser, then poll
// getPaymentStatus until 'paid'. Without keys the payment is recorded directly
// (status 'paid', no checkoutUrl) so dev testing still works.
export const payForServiceRequest = (requestId, { amount, method, stage }) =>
    request(`/service-requests/${requestId}/payment`, { method: 'POST', body: { amount, method, stage } });

// The latest payment attempt's status ('pending' | 'paid' | 'failed'). The backend
// re-checks PayMongo before answering, so polling this is the payment confirmation.
export const getPaymentStatus = (requestId) =>
    request(`/service-requests/${requestId}/payment-status`).then(pick('payment'));

// Rates a completed request (Ratings.js). One rating per request — 409 after that.
export const rateServiceRequest = (requestId, { rating, review }) =>
    request(`/service-requests/${requestId}/rating`, { method: 'POST', body: { rating, review } });

// Find screen: browse verified providers. category is a label from GET /categories
// ('All' = no filter); search matches name/company/specializations.
export const browseServiceProviders = ({ category, search } = {}) =>
    request('/service-providers', { query: { category, search } }).then(pick('providers'));

/* ------------------------- Provider side (Service Provider app) ------------------------- */
// The provider sees exactly the SERVICE_REQUEST rows customers sent to them from
// RecommendServiceProvider (provider_id = the logged-in provider). The backend scopes
// every call below to the authenticated provider and returns 403 if not verified.

// One call for the dashboard cards. Expected shape:
// {
//   stats: { activeJobs, jobsThisMonth, rating },          // rating null if no ratings yet
//   activeRepair: { requestId, statusLabel, customerName } | null,
//   notifications: [{ id, message, createdAt }],
//   pendingRequests: [{ id, requestNumber, customerName }]  // requests waiting on this provider
// }
export const getProviderDashboard = () => request('/provider/dashboard');

/**
 * Incoming request shape (the customer's draft, as saved by POST /service-requests):
 * {
 *   id, requestNumber,            // e.g. 'SR-0001'
 *   customerName, createdAt,
 *   status,                       // request_status (display only — the app doesn't match on it)
 *   canApprove,                   // true while this provider can still accept it (waiting on them)
 *   aiDiagnosis,                  // the SAME { probableCause, confidence, ... } the customer saw, or null
 *   distanceKm,                   // computed server-side: customer's lat/long vs this provider
 *   // detail only:
 *   category, description, photoUrl, address, preferredDate, preferredTime,
 * }
 * `filter`: 'new' = waiting for this provider to respond (pending_quotation),
 *           'pending' = in progress, waiting on the next step (accepted / quotation_sent),
 *           'all'. The backend owns that mapping.
 */
export const getIncomingRequests = ({ filter = 'all' } = {}) =>
    request('/provider/service-requests', { query: { filter } }).then(pick('requests'));

export const getProviderServiceRequest = (requestId) => request(`/provider/service-requests/${requestId}`).then(pick('request'));

// "Approve" — provider accepts the request. Backend sets the status, inserts a NOTIFICATION
// for the customer and sends the FCM push. 409 = customer cancelled / already handled.
export const acceptServiceRequest = (requestId) =>
    request(`/provider/service-requests/${requestId}/accept`, { method: 'POST' });

// For the ViewServiceRequest screen: provider can't take the job. Customer is notified so
// they can pick another provider.
export const declineServiceRequest = (requestId, { reason } = {}) =>
    request(`/provider/service-requests/${requestId}/decline`, { method: 'POST', body: { reason } });

// For the ViewServiceRequest screen: laborCost / partsCost -> QUOTATION.labor_cost / parts_cost,
// remarks -> QUOTATION.remarks. Backend sets 'quotation_sent' and notifies the customer.
export const submitQuotation = (requestId, { laborCost, partsCost, remarks }) =>
    request(`/provider/service-requests/${requestId}/quotation`, {
        method: 'POST',
        body: { laborCost, partsCost, remarks },
    });

// ---- Provider actions that the customer then sees on the Track screen ----
// (Called from the provider's ViewServiceRequest / Jobs screens. Each one makes the backend
// update the request, insert a NOTIFICATION for the customer and send them an FCM push.)

// Provider proposes a new appointment -> customer gets a 'schedule' card with Accept / Reject.
export const proposeSchedule = (requestId, { scheduledAt, reason }) =>
    request(`/provider/service-requests/${requestId}/schedule-proposals`, {
        method: 'POST',
        body: { scheduledAt, reason },
    });

// Provider needs more money mid-job -> customer gets a 'payment' card with Approve / Reject.
export const requestAdditionalPayment = (requestId, { amount, reason }) =>
    request(`/provider/service-requests/${requestId}/payment-requests`, {
        method: 'POST',
        body: { amount, reason },
    });

// Provider moves the job forward (e.g. 'on_the_way'); each step is appended to the customer's
// timeline card. Step names are owned by the backend.
export const updateJobProgress = (requestId, { step }) =>
    request(`/provider/service-requests/${requestId}/progress`, { method: 'POST', body: { step } });

// Provider finishes the job -> moves the customer's card to Done with the final amount
// (quotation + any approved additional payments) so they can Proceed to Payment.
export const completeJob = (requestId) =>
    request(`/provider/service-requests/${requestId}/complete`, { method: 'POST' });

/* ============================================================================
 * PROVIDER COMMUNICATION  (the provider-side API calls are live, above; the
 * Supabase Realtime helpers below are still commented out until the mobile
 * Supabase client exists)
 * ----------------------------------------------------------------------------
 * How the customer and the provider talk to each other:
 *
 *  1. Customer taps "Request Quotation"  ->  POST /service-requests { providerId, ... }
 *     In ONE backend transaction the server should:
 *       a. insert SERVICE_REQUEST          (request_status = 'pending_quotation', provider_id)
 *       b. insert SERVICE_REQUEST_ATTACHMENT (photoUrl) if present
 *       c. insert a NOTIFICATION row for the provider's user ("New service request")
 *       d. send an FCM push to the provider's registered device token(s)
 *
 *  2. Provider app sees it:   getIncomingRequests()   (+ the FCM push / Realtime below)
 *
 *  3. Provider responds with either:
 *       submitQuotation()       -> inserts QUOTATION, sets request_status = 'quotation_sent',
 *                             inserts a NOTIFICATION for the customer + FCM push
 *       declineServiceRequest() -> sets request_status = 'declined', notifies the customer so
 *                             they can pick another provider
 *
 *  4. Customer app updates without polling (Realtime below), so the dashboard's
 *     "Active Repair" card and Notifications refresh the moment the provider acts.
 *
 * // // Registers this device for FCM pushes (call after login, for customers AND providers).
 * // export const registerDeviceToken = (fcmToken) =>
 * //     request('/devices', { method: 'POST', body: { fcmToken } });
 *
 * // CAUTION before enabling Realtime: login here is custom (bcrypt + your own JWT_SECRET), and the
 * // backend talks to Supabase with the secret key. A mobile Supabase client uses the anon key, so
 * // Realtime only delivers rows if (a) Row Level Security policies allow them and (b) the app's
 * // token is one Supabase accepts (signed with the Supabase JWT secret, with the user id in `sub`).
 * // Neither is true today. Until then the screens already refresh on focus + pull-to-refresh, and
 * // the FCM push the backend sends on each action can trigger a reload — no Realtime needed.
 *
 * // ---- Supabase Realtime (needs your mobile Supabase client, e.g. ../lib/supabase) ----
 * // Table/column names below assume snake_case names from your ERD — adjust to match.
 * //
 * // import { supabase } from '../lib/supabase';
 * //
 * // // Customer side: fires when the provider quotes / declines this request.
 * // export const subscribeToServiceRequest = (requestId, onChange) => {
 * //     const channel = supabase
 * //         .channel(`service-request-${requestId}`)
 * //         .on(
 * //             'postgres_changes',
 * //             { event: 'UPDATE', schema: 'public', table: 'service_request', filter: `request_id=eq.${requestId}` },
 * //             (payload) => onChange(payload.new),
 * //         )
 * //         .subscribe();
 * //     return () => supabase.removeChannel(channel);
 * // };
 * //
 * // // Customer side, whole Track list: fires on any change to this customer's requests.
 * // export const subscribeToMyServiceRequests = (customerId, onChange) => {
 * //     const channel = supabase
 * //         .channel(`customer-requests-${customerId}`)
 * //         .on(
 * //             'postgres_changes',
 * //             { event: '*', schema: 'public', table: 'service_request', filter: `customer_id=eq.${customerId}` },
 * //             (payload) => onChange(payload.new),
 * //         )
 * //         .subscribe();
 * //     return () => supabase.removeChannel(channel);
 * // };
 * //
 * // // Provider side: fires when a customer sends this provider a new request.
 * // export const subscribeToIncomingRequests = (providerId, onNewRequest) => {
 * //     const channel = supabase
 * //         .channel(`provider-inbox-${providerId}`)
 * //         .on(
 * //             'postgres_changes',
 * //             { event: 'INSERT', schema: 'public', table: 'service_request', filter: `provider_id=eq.${providerId}` },
 * //             (payload) => onNewRequest(payload.new),
 * //         )
 * //         .subscribe();
 * //     return () => supabase.removeChannel(channel);
 * // };
 * ========================================================================== */