// src/controllers/servicerequest_controllers.js
// Customer side:  create request -> AI diagnosis (or skip) -> pick providers -> submit
// Provider side:  Incoming Service Requests list, request details, send quote, decline
//
// Schema (see migrations/001_align_schema_with_erd.sql):
//   service_requests(request_id PK, request_number identity, customer_id, provider_id,
//     category, description, ai_diagnosis jsonb, longitude, latitude, request_status,
//     date, time, created_at, updated_at)
//   service_request_providers(request_id, provider_id, status, declined_reason, sent_at, responded_at)
//   quotations(quotation_id PK, request_id, provider_id, labor_cost, parts_cost, ...)
//   service_request_attachments(attachment_id PK, request_id, file_url, filename, ...)
const config = require('../config');
const ApiError = require('../utils/api_error');
const asyncHandler = require('../utils/async_handler');
const Provider = require('../models/provider_model');
const Request = require('../models/servicerequest_model');
const { diagnose } = require('../utils/ai_diagnosis');
const { getProviderFileUrl } = require('../utils/storage');

// Same labels as CATEGORIES in CreateServiceRequest.jsx.
const CATEGORIES = ['Home Repair', 'Automotive', 'IT-Related Devices', 'Phone Device'];

// Request category -> the specialization name stored when a provider applies
// (CATEGORY_NAMES in the web api/client.js). Change if the mobile app uses other names.
const SPECIALIZATION_FOR_CATEGORY = {
  'Home Repair': 'Home Repair Services',
  Automotive: 'Automotive Services',
  'IT-Related Devices': 'IT-Related Device Repair',
  'Phone Device': 'Phone Repair',
};

// The web and the mobile app may label categories differently (e.g. the provider specialization
// names). Everything is stored with the labels in CATEGORIES above, so aliases are mapped here.
// Add a line when a client sends another label.
const CATEGORY_ALIASES = {
  'home repair': 'Home Repair',
  'home repair services': 'Home Repair',
  'home-repair': 'Home Repair', // mobile app category key (GET /api/categories)
  automotive: 'Automotive',
  'automotive services': 'Automotive',
  'it-related devices': 'IT-Related Devices',
  'it-related device repair': 'IT-Related Devices',
  'it related devices': 'IT-Related Devices',
  'phone device': 'Phone Device',
  'phone-device': 'Phone Device', // mobile app category key
  'phone repair': 'Phone Device',
};
const normalizeCategory = (value) => {
  const text = String(value || '').trim();
  return CATEGORIES.includes(text) ? text : CATEGORY_ALIASES[text.toLowerCase()] || '';
};

const MAX_PROVIDERS_PER_REQUEST = 5;

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// ---------- shapes sent to the frontend ----------
// ai_diagnosis is one jsonb column (ERD): { status: 'done' | 'skipped',
// probableCause, confidencePercent, relatedChecks, troubleshootingSuggestions }.
const aiStatusOf = (row) => row.ai_diagnosis?.status || 'pending';

const aiOf = (row) =>
  aiStatusOf(row) === 'done'
    ? {
        probableCause: row.ai_diagnosis.probableCause,
        confidencePercent: row.ai_diagnosis.confidencePercent,
        relatedChecks: row.ai_diagnosis.relatedChecks || [],
        troubleshootingSuggestions: row.ai_diagnosis.troubleshootingSuggestions || [],
      }
    : null;

// `recipients` = rows of service_request_providers, `users` = { [user_id]: { name } },
// `quotes` = { [provider_id]: quotations row }, `photoUrls` = signed attachment URLs.
const toCustomerDto = (row, recipients = [], users = {}, photoUrls = [], quotes = {}) => ({
  id: Request.formatRequestId(row.request_number),
  status: row.request_status,
  category: row.category,
  description: row.description,
  photoUrls,
  appointmentDate: row.date,
  appointmentTime: row.time,
  latitude: row.latitude,
  longitude: row.longitude,
  aiStatus: aiStatusOf(row),
  ai: aiOf(row),
  submittedAt: row.created_at,
  createdAt: row.created_at,
  providers: recipients.map((r) => {
    const q = quotes[r.provider_id];
    return {
      userId: r.provider_id,
      name: users[r.provider_id]?.name || 'Service provider',
      status: r.status,
      quote:
        r.status === 'quoted' && q
          ? { labor: Number(q.labor_cost) || 0, parts: Number(q.parts_cost) || 0, notes: q.remarks || '' }
          : null,
      declinedReason: r.declined_reason || null,
    };
  }),
});

// Shape expected by IncomingServiceRequest.jsx (one entry per request sent to this provider)
const toIncomingDto = (row, recipient, customer, quote) => {
  const ai = aiOf(row);
  return {
    id: Request.formatRequestId(row.request_number),
    customerName: customer?.name || 'Customer',
    createdAt: String(recipient.sent_at || row.created_at || '').slice(0, 10), // "2026-06-27"
    aiDiagnosis: ai?.probableCause ?? null,
    aiConfidence: ai?.confidencePercent ?? null,
    distanceKm: null, // TODO: compute from the provider's and the request's coordinates
    status: recipient.status === 'quoted' ? 'quoted' : 'new',
    quote:
      recipient.status === 'quoted' && quote
        ? { labor: Number(quote.labor_cost) || 0, parts: Number(quote.parts_cost) || 0 }
        : null,
  };
};

// Shape expected by ServiceRequestDetails.jsx
const toDetailsDto = (row, recipient, customer, photoUrls = []) => {
  const ai = aiOf(row);
  return {
    id: Request.formatRequestId(row.request_number),
    status: recipient.status === 'quoted' ? 'quoted' : 'new',
    customer: {
      name: customer?.name || 'Customer',
      address:
        customer?.address ||
        (row.latitude != null && row.longitude != null
          ? `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}`
          : ''),
      distanceKm: null,
      avatarUrl: null,
    },
    concern: row.description,
    photos: photoUrls,
    appointment: { date: row.date, time: row.time },
    ai: ai ? { diagnosis: ai.probableCause, confidence: ai.confidencePercent, possibleCauses: ai.relatedChecks } : null,
  };
};

// ---------- helpers ----------
const parseIdOr400 = (value) => {
  const requestNo = Request.parseRequestId(value);
  if (requestNo === null) throw new ApiError(400, 'Invalid request id');
  return requestNo;
};

// Loads a request and makes sure it belongs to the logged-in customer.
const getOwnedRequest = async (req) => {
  const row = await Request.findByRequestNo(parseIdOr400(req.params.requestId));
  if (!row || row.customer_id !== req.user.user_id) throw new ApiError(404, 'Service request not found');
  return row;
};

// A request is a draft (still editable) while it has not been sent to providers yet.
const requireDraft = (row) => {
  if (row.request_status !== 'New') throw new ApiError(409, 'This request was already submitted');
};

const groupByProvider = (quotations) =>
  Object.fromEntries((quotations || []).map((q) => [q.provider_id, q]));

// The full customer view of a request: recipients + their names, photos, quotes.
const customerView = async (row) => {
  const [recipients, photoMap, quotations] = await Promise.all([
    Request.listRecipients(row.request_id),
    Request.photoUrlsFor([row.request_id]),
    Request.listQuotations(row.request_id),
  ]);
  const users = await Request.findUsersByIds(recipients.map((r) => r.provider_id));
  return toCustomerDto(row, recipients, users, photoMap[row.request_id] || [], groupByProvider(quotations));
};

// ================= CUSTOMER =================

// POST /api/service-requests  (multipart: category, description, photo?, appointmentDate?, appointmentTime?, latitude?, longitude?)
// Creates the request as a draft (request_status 'New'); the customer then continues with the AI step.
// The mobile app stores the diagnosis under its own field names (see
// POST /service-requests/diagnose); map them back to the stored jsonb shape.
const mapMobileDiagnosis = (d) => ({
  status: 'done',
  probableCause: String(d.probableCause || ''),
  confidencePercent: Number.isFinite(Number(d.confidence)) ? Number(d.confidence) : 0,
  relatedChecks: Array.isArray(d.tags) ? d.tags : [],
  troubleshootingSuggestions: Array.isArray(d.troubleshootingSteps) ? d.troubleshootingSteps : [],
});

const create = asyncHandler(async (req, res) => {
  const category = normalizeCategory(req.body.category);
  const description = String(req.body.description || '').trim();
  if (!CATEGORIES.includes(category)) throw new ApiError(400, 'Choose a valid category');
  if (!description) throw new ApiError(400, 'Describe the problem');

  // The web app sends appointmentDate/appointmentTime (multipart); the mobile app sends
  // JSON with preferredDate/preferredTime, an already-uploaded photoPath, the AI
  // diagnosis, and optionally the chosen providerId (or resolvedByAi). clientRequestId /
  // Idempotency-Key are accepted for forward compatibility but not persisted (no column).
  const providerId = req.body.providerId || null;
  const resolvedByAi = Boolean(req.body.resolvedByAi);
  if (providerId) {
    const provider = await Provider.findByUserId(providerId);
    if (!provider) throw new ApiError(404, 'Service provider not found');
    if (providerId === req.user.user_id) throw new ApiError(400, 'You cannot send a request to yourself');
  }

  const row = await Request.create({
    customer_id: req.user.user_id,
    provider_id: null, // set when the customer accepts a provider (ERD: "Accepted by")
    category,
    description,
    date: req.body.appointmentDate || req.body.preferredDate || null, // "YYYY-MM-DD"
    time: req.body.appointmentTime || req.body.preferredTime || null, // "10:00 AM"
    latitude: toNumberOrNull(req.body.latitude),
    longitude: toNumberOrNull(req.body.longitude),
    ...(req.body.aiDiagnosis ? { ai_diagnosis: mapMobileDiagnosis(req.body.aiDiagnosis) } : {}),
    request_status: resolvedByAi ? 'Resolved' : providerId ? 'Pending' : 'New',
  });

  // Photos live in SERVICE_REQUEST_ATTACHMENT, one row per file (ERD). Multipart uploads
  // arrive as req.file; the mobile app uploads first (POST /photos) and sends the path.
  if (req.file) {
    const path = await Request.uploadPhoto(req.user.user_id, req.file);
    await Request.addAttachment({ request_id: row.request_id, file_url: path, filename: req.file.originalname });
  } else if (req.body.photoPath) {
    await Request.addAttachment({
      request_id: row.request_id,
      file_url: String(req.body.photoPath),
      filename: String(req.body.photoPath).split('/').pop() || 'photo',
    });
  }

  // Picked a provider: the request lands in their Incoming Service Requests list.
  if (providerId && !resolvedByAi) {
    await Request.addRecipients(row.request_id, [providerId]);
  }

  const request = await customerView(row);
  // `request` for the web app; requestId/requestStatus for the mobile app
  // (createServiceRequest in servicerequest_api.js reads those directly).
  res.status(201).json({ request, requestId: request.id, requestStatus: request.status });
});

// GET /api/service-requests — the customer's submitted requests (for Track Requests / History)
const listMine = asyncHandler(async (req, res) => {
  const rows = await Request.listForCustomer(req.user.user_id);
  const [recipientLists, photoMap, quotationLists] = await Promise.all([
    Promise.all(rows.map((r) => Request.listRecipients(r.request_id))),
    Request.photoUrlsFor(rows.map((r) => r.request_id)),
    Promise.all(rows.map((r) => Request.listQuotations(r.request_id))),
  ]);
  const users = await Request.findUsersByIds(recipientLists.flat().map((r) => r.provider_id));
  res.json({
    requests: rows.map((row, i) =>
      toCustomerDto(row, recipientLists[i], users, photoMap[row.request_id] || [], groupByProvider(quotationLists[i]))
    ),
  });
});

// GET /api/service-requests/:requestId
const getOne = asyncHandler(async (req, res) => {
  res.json({ request: await customerView(await getOwnedRequest(req)) });
});

// POST /api/service-requests/:requestId/ai-diagnosis
// Runs the AI diagnosis once and saves it; calling it again returns the saved result.
const aiDiagnosis = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  requireDraft(row);
  if (aiStatusOf(row) === 'done') return res.json({ diagnosis: aiOf(row) });

  const result = await diagnose({ category: row.category, description: row.description });
  const updated = await Request.update(row.request_number, { ai_diagnosis: { status: 'done', ...result } });
  return res.json({ diagnosis: aiOf(updated) });
});

// POST /api/service-requests/:requestId/skip-ai
const skipAi = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  requireDraft(row);
  const ai = aiStatusOf(row) === 'done' ? row.ai_diagnosis : { status: 'skipped' };
  const updated = await Request.update(row.request_number, { ai_diagnosis: ai });
  res.json({ request: await customerView(updated) });
});

// POST /api/service-requests/:requestId/resolve — the customer fixed it with the AI's help
const resolve = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  requireDraft(row);
  const updated = await Request.update(row.request_number, { request_status: 'Resolved' });
  res.json({ request: await customerView(updated) });
});

// GET /api/service-requests/:requestId/providers -> { providers: [...] }
// Verified providers, those matching the request's category first.
const recommendedProviders = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  const wanted = SPECIALIZATION_FOR_CATEGORY[row.category];

  const providers = await Request.listVerifiedProviders();
  const users = await Request.findUsersByIds(providers.map((p) => p.user_id));

  const list = providers
    .filter((p) => p.user_id !== req.user.user_id)
    .map((p) => ({
      id: p.user_id, // pass this in submitServiceRequest(requestId, [id, ...])
      userId: p.user_id,
      name: users[p.user_id]?.name || 'Service provider',
      experience: p.years_of_experience,
      specializations: p.specializations,
      offersHomeServices: Boolean(p.offers_home_service),
      photoUrl: p.profile_photo || null,
      rating: null, // TODO: average of the customer ratings (see Rating.jsx)
      distanceKm: null, // TODO
      matchesCategory: p.specializations.includes(wanted),
    }))
    .sort((a, b) => Number(b.matchesCategory) - Number(a.matchesCategory));

  res.json({ providers: list });
});

// GET /api/service-providers/recommended?category&latitude&longitude&exclude
// Mobile step 3 (RecommendServiceProvider.js): unlike recommendedProviders above, the
// request row does not exist yet (it is created on submit), so the draft's category and
// coordinates arrive as query params. Verified providers only, filtered by the request's
// service category (specialization match), then ranked by rating and distance.

// In-process geocode cache: provider addresses rarely change and Geocoding API calls
// cost money, so each distinct address is looked up once per server run.
const geocodeCache = new Map();
const geocodeAddress = async (address) => {
  const key = String(address || '').trim().toLowerCase();
  if (!key || !config.googleMaps.apiKey) return null;
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  let point = null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(key)}&key=${config.googleMaps.apiKey}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => null);
    const loc = data?.results?.[0]?.geometry?.location;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
      point = { lat: loc.lat, lng: loc.lng };
    }
  } catch {
    point = null; // distance stays null; the provider is still listed
  }
  geocodeCache.set(key, point);
  return point;
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

const recommendedForDraft = asyncHandler(async (req, res) => {
  const category = normalizeCategory(req.query.category);
  const wanted = SPECIALIZATION_FOR_CATEGORY[category] || '';
  const latitude = toNumberOrNull(req.query.latitude);
  const longitude = toNumberOrNull(req.query.longitude);
  // `exclude` arrives as repeated params and/or comma-separated ids, depending on the client.
  const exclude = new Set(
    (Array.isArray(req.query.exclude) ? req.query.exclude : [req.query.exclude])
      .filter((v) => v !== undefined && v !== null)
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter(Boolean)
  );

  const providers = await Request.listVerifiedProviders();
  const candidates = providers.filter(
    (p) => p.user_id !== req.user.user_id && !exclude.has(String(p.user_id))
  );
  const [users, ratings] = await Promise.all([
    Request.findUsersByIds(candidates.map((p) => p.user_id)),
    Request.listRatingsForProviders(candidates.map((p) => p.user_id)),
  ]);

  // Distance: providers store a text address (company_address), not coordinates, so it
  // is geocoded (cached) and measured against the customer's latitude/longitude.
  const list = await Promise.all(
    candidates.map(async (p) => {
      const address = p.company_address || users[p.user_id]?.address || '';
      let distanceKm = null;
      if (latitude !== null && longitude !== null && address) {
        const point = await geocodeAddress(address);
        if (point) distanceKm = Math.round(haversineKm(latitude, longitude, point.lat, point.lng) * 10) / 10;
      }
      const rating = ratings[p.user_id];
      return {
        id: p.user_id, // pass this back as providerId in POST /service-requests
        name: users[p.user_id]?.name || p.company_name || 'Service provider',
        specialty: p.specializations[0] || '',
        specialties: p.specializations,
        verified: true,
        available: true,
        availabilitySchedule: p.availability || null,
        rating: rating ? Math.round(rating.rating * 10) / 10 : null,
        reviewCount: rating?.reviewCount || 0,
        experienceYears: p.years_of_experience ?? null,
        offersHomeServices: Boolean(p.offers_home_service),
        // profile_photo is a private storage path; sign it so the app can render it.
        photoUrl: await getProviderFileUrl(p.profile_photo),
        locationName: address,
        distanceKm,
        matchesCategory: wanted ? p.specializations.includes(wanted) : false,
      };
    })
  );

  // Filter by the service category; if nobody matches, fall back to all verified
  // providers so the screen never dead-ends. Rank by rating, then distance.
  const matching = list.filter((p) => p.matchesCategory);
  const pool = wanted && matching.length > 0 ? matching : list;
  pool.sort(
    (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  );

  res.json({ providers: pool });
});

// POST /api/service-requests/:requestId/submit   body: { providerIds: [user_id, ...] }
// Sends the request to the chosen providers: it now shows up in each one's Incoming Service Requests.
const submit = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  requireDraft(row);

  const providerIds = [...new Set(Array.isArray(req.body.providerIds) ? req.body.providerIds : [req.body.providerId])]
    .filter(Boolean);
  if (providerIds.length === 0) throw new ApiError(400, 'Choose a service provider');
  if (providerIds.length > MAX_PROVIDERS_PER_REQUEST) {
    throw new ApiError(400, `You can send a request to at most ${MAX_PROVIDERS_PER_REQUEST} providers`);
  }
  if (providerIds.includes(req.user.user_id)) throw new ApiError(400, 'You cannot send a request to yourself');

  const found = await Promise.all(providerIds.map((id) => Provider.findByUserId(id)));
  if (found.some((p) => !p)) throw new ApiError(404, 'Service provider not found');

  await Request.addRecipients(row.request_id, providerIds);
  const updated = await Request.update(row.request_number, { request_status: 'Pending' });
  // TODO: create a "new_request" notification for each provider (see Notifications.jsx).
  res.json({ request: await customerView(updated) });
});

// ================= SERVICE PROVIDER =================

// Loads the request + this provider's own recipient row for it, or 404.
const getIncomingPair = async (req) => {
  const row = await Request.findByRequestNo(parseIdOr400(req.params.requestId));
  if (!row) throw new ApiError(404, 'Service request not found');
  const recipient = await Request.findRecipient(row.request_id, req.user.user_id);
  if (!recipient) throw new ApiError(404, 'Service request not found');
  return { row, recipient };
};

// GET /api/providers/requests -> { requests: [...] } (shape of IncomingServiceRequest.jsx)
const listIncoming = asyncHandler(async (req, res) => {
  const recipients = await Request.listRecipientsForProvider(req.user.user_id, ['sent', 'quoted']);
  const rows = await Request.findByIds(recipients.map((r) => r.request_id));
  const byId = Object.fromEntries(rows.map((r) => [r.request_id, r]));
  const customers = await Request.findUsersByIds(rows.map((r) => r.customer_id));
  const quoteRows = await Request.listQuotationsForProvider(
    req.user.user_id,
    recipients.map((r) => r.request_id)
  );
  const quoteByRequest = Object.fromEntries(quoteRows.map((q) => [q.request_id, q]));

  res.json({
    requests: recipients
      .filter((r) => byId[r.request_id])
      .map((r) => toIncomingDto(byId[r.request_id], r, customers[byId[r.request_id].customer_id], quoteByRequest[r.request_id])),
  });
});

// GET /api/providers/requests/:requestId -> { request: {...} } (shape of ServiceRequestDetails.jsx)
const getIncoming = asyncHandler(async (req, res) => {
  const { row, recipient } = await getIncomingPair(req);
  const [customers, photoMap] = await Promise.all([
    Request.findUsersByIds([row.customer_id]),
    Request.photoUrlsFor([row.request_id]),
  ]);
  res.json({ request: toDetailsDto(row, recipient, customers[row.customer_id], photoMap[row.request_id] || []) });
});

// POST /api/providers/requests/:requestId/quote   body: { laborPrice, itemPrice, notes }
// The quote is a QUOTATION row (ERD); the recipient row only tracks the response state.
const sendQuote = asyncHandler(async (req, res) => {
  const { row, recipient } = await getIncomingPair(req);
  if (recipient.status !== 'sent') throw new ApiError(409, 'You already responded to this request');

  const labor = Number(req.body.laborPrice) || 0;
  const parts = Number(req.body.itemPrice) || 0;
  if (labor < 0 || parts < 0 || labor + parts <= 0) throw new ApiError(400, 'Enter a labor or item price');

  const quote = await Request.addQuotation({
    request_id: row.request_id,
    provider_id: req.user.user_id,
    labor_cost: labor,
    parts_cost: parts,
    remarks: String(req.body.notes || '').trim() || null,
  });
  const updated = await Request.updateRecipient(row.request_id, req.user.user_id, {
    status: 'quoted',
    responded_at: new Date().toISOString(),
  });
  // TODO: create a "quotation_received" notification for the customer (see Notifications.jsx).
  const customers = await Request.findUsersByIds([row.customer_id]);
  res.json({ request: toIncomingDto(row, updated, customers[row.customer_id], quote) });
});

// POST /api/providers/requests/:requestId/reject   body: { reason }
const rejectRequest = asyncHandler(async (req, res) => {
  const { row, recipient } = await getIncomingPair(req);
  if (recipient.status !== 'sent') throw new ApiError(409, 'You already responded to this request');

  const reason = String(req.body.reason || '').trim();
  if (!reason) throw new ApiError(400, 'State a reason for rejection');

  await Request.updateRecipient(row.request_id, req.user.user_id, {
    status: 'declined',
    declined_reason: reason,
    responded_at: new Date().toISOString(),
  });
  res.json({ ok: true });
});

// ================= META (mobile app, "Create Service Request" step 1) =================

// GET /api/categories -> { categories: [{ key, label, specializationNames }] }
// `key` is the kebab-case id the mobile app stores as its categoryKey; CATEGORY_ALIASES
// above maps it back to the stored label when the request is created/diagnosed.
const categoryKey = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const listCategories = (req, res) => {
  res.json({
    categories: CATEGORIES.map((label) => ({
      key: categoryKey(label),
      label,
      specializationNames: [SPECIALIZATION_FOR_CATEGORY[label]],
    })),
  });
};

// GET /api/appointment-time-slots -> { timeSlots: [{ value, label }] }
// The customer's PREFERRED slots (no provider chosen yet), same list as the web app.
const TIME_SLOTS = ['10:00 AM', '11:00 AM', '01:00 PM', '02:00 PM'];

const listTimeSlots = (req, res) => {
  res.json({ timeSlots: TIME_SLOTS.map((label) => ({ value: label, label })) });
};

// POST /api/service-requests/photos (multipart, field "photo") -> { photo: { path } }
// The mobile app uploads the photo BEFORE any SERVICE_REQUEST row exists (it creates the
// row only on submit), so this just stores the file and returns its storage path. The path
// travels with the draft and becomes a service_request_attachments row on submit.
const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Attach a photo');
  const path = await Request.uploadPhoto(req.user.user_id, req.file);
  res.status(201).json({ photo: { path } });
});

// POST /api/service-requests/diagnose  body: { category, description, photoPath?, latitude?, longitude? }
// Mobile step 2: a diagnosis for a draft that has no SERVICE_REQUEST row yet (unlike
// aiDiagnosis above, which works on a saved draft). Same diagnosis engine; the response
// uses the mobile app's field names (confidence, tags, troubleshootingSteps, lowConfidence).
const LOW_CONFIDENCE_THRESHOLD = 50;

const diagnoseDraft = asyncHandler(async (req, res) => {
  const category = normalizeCategory(req.body.category);
  const description = String(req.body.description || '').trim();
  if (!category) throw new ApiError(400, 'Choose a valid category');
  if (!description) throw new ApiError(400, 'Describe the problem');

  const result = await diagnose({ category, description });
  res.json({
    diagnosis: {
      probableCause: result.probableCause,
      confidence: result.confidencePercent,
      tags: result.relatedChecks,
      troubleshootingSteps: result.troubleshootingSuggestions,
      lowConfidence: result.confidencePercent < LOW_CONFIDENCE_THRESHOLD,
    },
  });
});

// GET /api/location/reverse-geocode?latitude&longitude -> { location: { address, mapImageUri } }
// Proxied through the backend so the Google Maps key is applied here, not hardcoded in the
// apps. With GOOGLE_MAPS_API_KEY set, the address comes from Google's Geocoding API and
// mapImageUri is a Google Static Maps snapshot (pin on the coordinates) — the apps render it
// as the "like Google Maps" location image. Without a key, the address falls back to
// OpenStreetMap's Nominatim and mapImageUri stays null (the apps already handle that).
const reverseGeocode = asyncHandler(async (req, res) => {
  const lat = Number(req.query.latitude);
  const lon = Number(req.query.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new ApiError(400, 'latitude and longitude are required');
  }

  const mapsKey = config.googleMaps.apiKey;
  // The Static Maps URL must carry the key to load; restrict the key in Google Cloud
  // Console (Geocoding API + Maps Static API only) since it ends up in the apps' traffic.
  const mapImageUri = mapsKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=16&size=600x300&scale=2&maptype=roadmap` +
      `&markers=color:0x0255AF%7C${lat},${lon}&key=${mapsKey}`
    : null;

  let address = null;
  if (mapsKey) {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${mapsKey}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK') address = data.results?.[0]?.formatted_address || null;
      }
    } catch (err) {
      console.error('[reverse-geocode] Google Geocoding failed, trying the fallback:', err.message);
    }
  }

  if (!address) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
        {
          headers: { 'User-Agent': 'ServEase/1.0 (service marketplace app)' },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (response.ok) {
        const data = await response.json();
        address = data.display_name || null;
      }
    } catch (err) {
      console.error('[reverse-geocode] failed, using the coordinates instead:', err.message);
    }
  }

  res.json({
    location: {
      address: address || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
      mapImageUri,
    },
  });
});

module.exports = {
  create,
  listMine,
  getOne,
  aiDiagnosis,
  skipAi,
  resolve,
  recommendedProviders,
  recommendedForDraft,
  submit,
  listIncoming,
  getIncoming,
  sendQuote,
  rejectRequest,
  listCategories,
  listTimeSlots,
  uploadPhoto,
  diagnoseDraft,
  reverseGeocode,
};
