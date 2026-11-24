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
const Workflow = require('../models/workflow_model');
const { diagnose } = require('../utils/ai_diagnosis');
const {
  toQuoteDto,
  serviceFeeFor,
  isCustomerQuotationDecline,
  decodeCustomerQuotationDecline,
} = require('../utils/pricing');
const { getProviderFileUrl } = require('../utils/storage');
const {
  APPOINTMENT_HOURS,
  APPOINTMENT_SLOTS_24,
  formatAppointmentSlot,
  isWholeDayBlocked,
} = require('../utils/appointment_slots');
const {
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  DEFAULT_PROVIDER_RADIUS_KM,
  DEFAULT_CUSTOMER_RADIUS_KM,
  clampRadiusKm,
  parseRadiusKm,
} = require('../utils/radius');

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
// The mobile app sends the kebab-case key from GET /api/categories (e.g.
// 'it-related-devices'); the web app sends the label. Compare slug-to-slug so every
// variant maps back — 'it-related-devices' previously matched nothing (the alias list
// only had the spaced form), so ONLY the IT category failed diagnose/recommend/create.
const toCategorySlug = (value) =>
  String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const CATEGORY_BY_SLUG = Object.fromEntries(CATEGORIES.map((label) => [toCategorySlug(label), label]));
const ALIAS_BY_SLUG = Object.fromEntries(
  Object.entries(CATEGORY_ALIASES).map(([alias, label]) => [toCategorySlug(alias), label])
);

const normalizeCategory = (value) => {
  const text = String(value || '').trim();
  if (CATEGORIES.includes(text)) return text;
  return (
    CATEGORY_ALIASES[text.toLowerCase()] ||
    CATEGORY_BY_SLUG[toCategorySlug(text)] ||
    ALIAS_BY_SLUG[toCategorySlug(text)] ||
    ''
  );
};

const MAX_PROVIDERS_PER_REQUEST = 5;

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// Display name for the "new_request" notification the provider receives
// (same lookup as customerNameOf in workflow_controllers.js).
// Where the repair happens, from the mobile CreateServiceRequest dropdown: 'home' | 'shop'.
const toLocationTypeOrNull = (value) => (value === 'home' || value === 'shop' ? value : null);

const customerNameOf = async (row) => {
  const users = await Request.findUsersByIds([row.customer_id]);
  return users[row.customer_id]?.name || 'Customer';
};

// In-app notification + FCM push so the provider knows a request just landed
// (instantly, like the other workflow events). Best-effort: notify() never throws.
const notifyProvidersOfNewRequest = async (row, providerIds) => {
  const customerName = await customerNameOf(row);
  const ref = Request.formatRequestId(row.request_number);
  await Promise.all(
    providerIds.map((providerId) =>
      Workflow.notify({
        userId: providerId,
        type: 'new_request',
        message: `${customerName} sent you a new ${row.category} service request (${ref}).`,
        requestId: row.request_id,
      })
    )
  );
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

// Typed attachments are the primary media contract. Legacy image-only URL arrays remain available
// for older clients, but videos are never mislabeled as photos.
const imageUrls = (attachments = []) =>
  attachments.filter((attachment) => attachment.type === 'image').map((attachment) => attachment.url);

// `recipients` = rows of service_request_providers, `users` = { [user_id]: { name } },
// `quotes` = { [provider_id]: quotations row }, `attachments` = typed, signed media objects.
const toCustomerDto = (row, recipients = [], users = {}, attachments = [], quotes = {}) => ({
  id: Request.formatRequestId(row.request_number),
  status: row.request_status,
  category: row.category,
  description: row.description,
  photoUrls: imageUrls(attachments),
  attachments,
  appointmentDate: row.date,
  appointmentTime: row.time,
  serviceLocationType: row.service_location_type ?? null, // 'home' | 'shop'
  searchRadiusKm: row.search_radius_km ?? null,
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
          ? { ...toQuoteDto(q), notes: q.remarks || '' } // labor, parts, serviceFee, total, initialFeePercent, initialAmount
          : null,
      declinedReason: r.declined_reason || null,
    };
  }),
});

// Shape expected by IncomingServiceRequest.jsx (one entry per request sent to this provider)
//   status: 'new'    = waiting on this provider (no quotation yet)
//           'quoted' = Pending: quotation sent, the customer has not answered
//           'closed' = declined by this provider OR the customer declined the quotation
const closedInfoOf = (recipient) => {
  if (recipient.status !== 'declined') return { closedBy: null, declinedReason: null };
  const byCustomer = isCustomerQuotationDecline(recipient.declined_reason);
  return {
    closedBy: byCustomer ? 'customer' : 'provider',
    declinedReason: byCustomer
      ? decodeCustomerQuotationDecline(recipient.declined_reason)
      : recipient.declined_reason || null,
  };
};

const toIncomingDto = (row, recipient, customer, quote, distanceKm = null) => {
  const ai = aiOf(row);
  const reference = Request.formatRequestId(row.request_number);
  const isQuoted = recipient.status === 'quoted';
  const isClosed = recipient.status === 'declined';
  const hasQuote = (isQuoted || isClosed) && quote;
  const labor = hasQuote ? Number(quote.labor_cost) || 0 : 0;
  const parts = hasQuote ? Number(quote.parts_cost) || 0 : 0;
  return {
    id: reference,
    requestNumber: reference, // mobile list: "Request #SR-0001" (same value as id)
    customerName: customer?.name || 'Customer',
    createdAt: String(recipient.sent_at || row.created_at || '').slice(0, 10), // "2026-06-27"
    category: row.category ?? null, // Categories dropdown on the web list
    aiDiagnosis: ai?.probableCause ?? null,
    aiConfidence: ai?.confidencePercent ?? null,
    distanceKm, // provider's geocoded company_address -> the request's pin (null if either is unknown)
    serviceLocationType: row.service_location_type ?? null, // 'home' | 'shop'
    status: isClosed ? 'closed' : isQuoted ? 'quoted' : 'new',
    statusLabel: isClosed ? 'Declined' : isQuoted ? 'Quoted' : 'New', // mobile status pill
    canApprove: recipient.status === 'sent', // mobile: Accept is offered while still waiting on this provider
    ...closedInfoOf(recipient),
    quote: hasQuote ? { labor, parts } : null,
    // Mobile "Pending" card: Quote sent: <labor> (Labor), <parts> (Parts) / TOTAL
    quotation: isQuoted && quote ? { laborCost: labor, partsCost: parts, total: labor + parts } : null,
  };
};

// Shape expected by ServiceRequestDetails.jsx
const toDetailsDto = (row, recipient, customer, attachments = [], distanceKm = null, quote = null) => {
  const ai = aiOf(row);
  const isQuoted = recipient.status === 'quoted';
  const isClosed = recipient.status === 'declined';
  return {
    id: Request.formatRequestId(row.request_number),
    requestNumber: Request.formatRequestId(row.request_number), // mobile
    status: isClosed ? 'closed' : isQuoted ? 'quoted' : 'new',
    canApprove: recipient.status === 'sent', // mobile: Decline / Accept only while waiting on this provider
    ...closedInfoOf(recipient),
    quote:
      (isQuoted || isClosed) && quote
        ? { labor: Number(quote.labor_cost) || 0, parts: Number(quote.parts_cost) || 0 }
        : null,
    category: row.category ?? null,
    customer: {
      name: customer?.name || 'Customer',
      address:
        row.address ||
        customer?.address ||
        (row.latitude != null && row.longitude != null
          ? `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}`
          : ''),
      distanceKm,
      avatarUrl: null,
    },
    serviceLocationType: row.service_location_type ?? null,
    concern: row.description,
    photos: imageUrls(attachments),
    attachments, // typed + signed: [{ url, type: 'image' | 'video', filename }]
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

// The full customer view of a request: recipients + their names, typed media attachments, quotes.
const customerView = async (row) => {
  const [recipients, attachmentMap, quotations] = await Promise.all([
    Request.listRecipients(row.request_id),
    Request.attachmentsFor([row.request_id]),
    Request.listQuotations(row.request_id),
  ]);
  const users = await Request.findUsersByIds(recipients.map((r) => r.provider_id));
  return toCustomerDto(row, recipients, users, attachmentMap[row.request_id] || [], groupByProvider(quotations));
};

// ================= CUSTOMER =================

// POST /api/service-requests
// Web multipart: category, description, photos? (repeat, max 4), video? (max 1), appointment fields.
// Mobile JSON: preferredDate/preferredTime plus attachmentPaths and the legacy photoPath.
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

    // The provider may have become unavailable between the recommendation list and
    // this submit (RecommendServiceProvider.js handles this exact 409).
    const scheduledDate = toIsoDateOrNull(req.body.appointmentDate || req.body.preferredDate);
    if (scheduledDate) {
      const scheduledSlot = to24hSlot(req.body.appointmentTime || req.body.preferredTime);
      const blocked = await unavailableForSchedule([providerId], scheduledDate, scheduledSlot);
      if (blocked.has(providerId)) {
        throw new ApiError(409, 'This service provider is unavailable on the selected schedule');
      }
    }
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
    service_location_type: toLocationTypeOrNull(req.body.serviceLocationType),
    search_radius_km:
      req.body.searchRadiusKm !== undefined && req.body.searchRadiusKm !== null && req.body.searchRadiusKm !== ''
        ? parseRadiusKm(req.body.searchRadiusKm)
        : null,
    // The mobile app reverse-geocodes the pin and sends the readable address too
    // (migration 002 adds the column); the provider sees it on ViewServiceRequest.
    address: req.body.address ? String(req.body.address).trim() : null,
    ...(req.body.aiDiagnosis ? { ai_diagnosis: mapMobileDiagnosis(req.body.aiDiagnosis) } : {}),
    request_status: resolvedByAi ? 'Resolved' : providerId ? 'Pending' : 'New',
  });

  // Store every web multipart file and every pre-uploaded mobile attachment. `photoPath` remains
  // supported for older mobile builds; the set prevents it duplicating the first item in attachmentPaths.
  const files = req.files ? Object.values(req.files).flat() : req.file ? [req.file] : [];
  const storedPaths = new Set();
  const addStoredAttachment = async (path, filename, mediaTypeOrMime = 'image') => {
    const normalizedPath = String(path || '').trim();
    if (!normalizedPath || storedPaths.has(normalizedPath)) return;
    storedPaths.add(normalizedPath);
    await Request.addAttachment({
      request_id: row.request_id,
      file_url: normalizedPath,
      filename: filename || normalizedPath.split('/').pop() || 'attachment',
      media_type:
        mediaTypeOrMime === 'video' || String(mediaTypeOrMime).toLowerCase().startsWith('video/') ? 'video' : 'image',
    });
  };

  for (const file of files) {
    const path = await Request.uploadPhoto(req.user.user_id, file);
    await addStoredAttachment(path, file.originalname, file.mimetype);
  }

  const attachmentPaths = Array.isArray(req.body.attachmentPaths) ? [...req.body.attachmentPaths] : [];
  if (req.body.photoPath) attachmentPaths.push({ path: req.body.photoPath, type: 'photo' });
  for (const attachment of attachmentPaths) {
    const path = typeof attachment === 'string' ? attachment : attachment?.path;
    await addStoredAttachment(path, attachment?.filename, attachment?.type || 'image');
  }

  // Picked a provider: the request lands in their Incoming Service Requests list,
  // and they get an instant in-app notification + push.
  if (providerId && !resolvedByAi) {
    await Request.addRecipients(row.request_id, [providerId]);
    await notifyProvidersOfNewRequest(row, [providerId]);
  }

  const request = await customerView(row);
  // `request` for the web app; requestId/requestStatus for the mobile app
  // (createServiceRequest in servicerequest_api.js reads those directly).
  res.status(201).json({ request, requestId: request.id, requestStatus: request.status });
});

// GET /api/service-requests — the customer's submitted requests (for Track Requests / History)
const listMine = asyncHandler(async (req, res) => {
  const rows = await Request.listForCustomer(req.user.user_id);
  const [recipientLists, attachmentMap, quotationLists] = await Promise.all([
    Promise.all(rows.map((r) => Request.listRecipients(r.request_id))),
    Request.attachmentsFor(rows.map((r) => r.request_id)),
    Promise.all(rows.map((r) => Request.listQuotations(r.request_id))),
  ]);
  const users = await Request.findUsersByIds(recipientLists.flat().map((r) => r.provider_id));
  res.json({
    requests: rows.map((row, i) =>
      toCustomerDto(row, recipientLists[i], users, attachmentMap[row.request_id] || [], groupByProvider(quotationLists[i]))
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

// DELETE /api/service-requests/:requestId/draft — discard an unsubmitted request and its attachment rows.
const cancelDraft = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  requireDraft(row);
  await Request.deleteDraft(row.request_id, req.user.user_id);
  res.json({ ok: true });
});

// POST /api/service-requests/:requestId/resolve — the customer fixed it with the AI's help
const resolve = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  requireDraft(row);
  const updated = await Request.update(row.request_number, { request_status: 'Resolved' });
  res.json({ request: await customerView(updated) });
});

// GET /api/service-requests/:requestId/providers -> { providers: [...] }
// Web step 3 (RecommendServiceProvider.jsx). Verified providers for a SAVED draft, ranked: the
// request's category first, then rating (highest first), then distance. Every provider carries what
// the cards show — verified, available (can they take the request's preferred date/time?), rating,
// reviewCount, experience, locationName, distanceKm, availabilitySchedule — plus `recommended`,
// which marks the best matches the screen pre-selects.
const RECOMMENDED_COUNT = 2;

const recommendedProviders = asyncHandler(async (req, res) => {
  const row = await getOwnedRequest(req);
  const wanted = SPECIALIZATION_FOR_CATEGORY[row.category];
  const latitude = toNumberOrNull(row.latitude);
  const longitude = toNumberOrNull(row.longitude);
  const hasPin = latitude !== null && longitude !== null;
  const scheduledDate = toIsoDateOrNull(row.date);
  const scheduledSlot = to24hSlot(row.time);
  const locationType = toLocationTypeOrNull(row.service_location_type); // 'home' | 'shop' | null
  // The radius the customer set on the map in step 1. If it was never saved on the draft the
  // default is used and `radiusSaved` is false, so the problem is visible in the response.
  const radiusKm = clampRadiusKm(row.search_radius_km, DEFAULT_CUSTOMER_RADIUS_KM);

  const providers = await Request.listVerifiedProviders();
  const candidates = providers.filter((p) => p.user_id !== req.user.user_id);
  const ids = candidates.map((p) => p.user_id);
  const [users, ratings, unavailable] = await Promise.all([
    Request.findUsersByIds(ids),
    Request.listRatingsForProviders(ids),
    unavailableForSchedule(ids, scheduledDate, scheduledSlot),
  ]);

  const list = await Promise.all(
    candidates.map(async (p) => {
      // Providers store a text address, not coordinates: geocode it (cached) and measure the
      // distance to the request's pin. Without a pin or an address the distance stays null.
      const address = p.company_address || users[p.user_id]?.address || '';
      let distanceKm = null;
      if (hasPin && address) {
        const point = await geocodeAddress(address);
        if (point) distanceKm = Math.round(haversineKm(latitude, longitude, point.lat, point.lng) * 10) / 10;
      }
      const rating = ratings[p.user_id];
      return {
        id: p.user_id, // pass this in submitServiceRequest(requestId, [id, ...])
        userId: p.user_id,
        name: users[p.user_id]?.name || p.company_name || 'Service provider',
        experience: p.years_of_experience,
        specializations: p.specializations,
        offersHomeServices: Boolean(p.offers_home_service),
        // How far this provider travels for home service; null when they don't offer it.
        homeServiceRadiusKm: p.offers_home_service ? p.home_service_radius_km ?? DEFAULT_PROVIDER_RADIUS_KM : null,
        availabilitySchedule: p.availability || null,
        // profile_photo is a private storage path; sign it so the browser can render it.
        photoUrl: await getProviderFileUrl(p.profile_photo),
        verified: true, // listVerifiedProviders only returns verified providers
        available: !unavailable.has(p.user_id),
        rating: rating ? Math.round(rating.rating * 10) / 10 : null,
        reviewCount: rating?.reviewCount || 0,
        locationName: address,
        distanceKm,
        matchesCategory: wanted ? p.specializations.includes(wanted) : false,
        recommended: false,
      };
    })
  );

  // A provider is only returned when ALL of these hold; `hidden` counts why the rest were left out
  // (each provider is counted once, under the first rule it fails).
  //   1. specialized in the request's category
  //   2. free on the requested date/time (explicit calendar blocks and existing jobs)
  //   3. HOME request: offers home service
  //   4. within the customer's search radius and, for a HOME request, within the provider's own
  //      home-service range. With a pin on the request, a provider whose distance cannot be
  //      measured is NOT shown (we cannot prove they are in reach).
  const hidden = { category: 0, unavailable: 0, noHomeService: 0, outOfRange: 0, unknownDistance: 0 };
  const visible = list.filter((p) => {
    if (wanted && !p.matchesCategory) return hidden.category++, false;
    if (!p.available) return hidden.unavailable++, false;
    if (locationType === 'home' && !p.offersHomeServices) return hidden.noHomeService++, false;
    if (hasPin) {
      if (p.distanceKm === null) return hidden.unknownDistance++, false;
      if (p.distanceKm > radiusKm) return hidden.outOfRange++, false;
      if (locationType === 'home' && p.distanceKm > (p.homeServiceRadiusKm ?? DEFAULT_PROVIDER_RADIUS_KM)) {
        return hidden.outOfRange++, false;
      }
    }
    return true;
  });

  visible.sort(
    (a, b) =>
      (b.rating ?? -1) - (a.rating ?? -1) ||
      (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  );
  visible.slice(0, RECOMMENDED_COUNT).forEach((p) => {
    p.recommended = true;
  });

  res.json({
    providers: visible,
    radiusKm,
    radiusSaved: row.search_radius_km !== null && row.search_radius_km !== undefined,
    serviceLocationType: locationType,
    schedule: { date: scheduledDate, time: row.time || null },
    hidden,
  });
});

// ================= AVAILABILITY FOR THE DRAFT'S SCHEDULE =================
// The mobile draft carries a preferred date ('YYYY-MM-DD') and time slot; a provider
// who can't take that schedule must not be recommended at all.

// '10:00 AM' (web app) / '13:00' (mobile slot values) -> 24-hour 'HH:00', the way
// provider_unavailable_slots.slot is stored. Same parsing as to24h in
// workflow_controllers.js.
const to24hSlot = (value) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(value || '').trim());
  if (!m) return null;
  let h = Number(m[1]);
  if (/PM/i.test(m[3] || '') && h !== 12) h += 12;
  if (/AM/i.test(m[3] || '') && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:00`;
};

// Ids of the providers who can't take the given schedule (date + optional 24-hour
// slot): they explicitly blocked it on Manage Calendar (that slot or the whole universal
// appointment grid), or they already have a request at a conflicting slot. Profile working
// days/hours are informational and never block an appointment automatically.
const unavailableForSchedule = async (providerIds, date, slot) => {
  const unavailable = new Set();
  if (!date) return unavailable;

  const calendarRows = await Workflow.listUnavailableSlotsFor(providerIds, date);
  const slotsByProvider = new Map();
  calendarRows.forEach((r) => {
    // Normalize 'HH:mm:ss' / '9:00 AM' style values to 'HH:00' before comparing.
    const normalized = to24hSlot(String(r.slot).slice(0, 5)) || to24hSlot(r.slot) || String(r.slot).slice(0, 5);
    if (!slotsByProvider.has(r.provider_id)) slotsByProvider.set(r.provider_id, new Set());
    slotsByProvider.get(r.provider_id).add(normalized);
  });
  slotsByProvider.forEach((slots, providerId) => {
    if (isWholeDayBlocked(slots) || (slot && slots.has(slot))) unavailable.add(providerId);
  });

  const engagements = await Request.listActiveEngagementsOnDate(providerIds, date);
  engagements.forEach((e) => {
    const bookedSlot = to24hSlot(e.time);
    if (!slot || !bookedSlot || bookedSlot === slot) unavailable.add(e.provider_id);
  });

  return unavailable;
};

// 'YYYY-MM-DD' from a query/body value, or null when it isn't a valid date.
const toIsoDateOrNull = (value) => {
  const text = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

// GET /api/service-requests/time-slots?date=YYYY-MM-DD&category&latitude&longitude&radiusKm
// A universal slot is available when at least one eligible verified provider has neither an explicit
// calendar block nor a conflicting engagement. Profile working hours intentionally play no part.
const getAppointmentSlots = asyncHandler(async (req, res) => {
  const date = toIsoDateOrNull(req.query.date);
  if (!date) throw new ApiError(400, 'date must be YYYY-MM-DD');

  const category = req.query.category ? normalizeCategory(req.query.category) : null;
  if (req.query.category && !category) throw new ApiError(400, 'Choose a valid category');
  const wanted = SPECIALIZATION_FOR_CATEGORY[category] || '';
  const latitude = toNumberOrNull(req.query.latitude);
  const longitude = toNumberOrNull(req.query.longitude);
  const hasPin = latitude !== null && longitude !== null;
  const radiusKm = clampRadiusKm(req.query.radiusKm, DEFAULT_CUSTOMER_RADIUS_KM);

  const providers = await Request.listVerifiedProviders();
  const candidates = providers.filter(
    (p) => p.user_id !== req.user.user_id && (!wanted || p.specializations.includes(wanted))
  );
  const users = await Request.findUsersByIds(candidates.map((p) => p.user_id));

  // Match the existing mobile recommendation rule: unknown distances remain eligible.
  let eligible = candidates;
  if (hasPin) {
    const measured = await Promise.all(
      candidates.map(async (p) => {
        const address = p.company_address || users[p.user_id]?.address || '';
        const point = address ? await geocodeAddress(address) : null;
        const distanceKm = point
          ? haversineKm(latitude, longitude, point.lat, point.lng)
          : null;
        return { provider: p, distanceKm };
      })
    );
    eligible = measured
      .filter((entry) => entry.distanceKm === null || entry.distanceKm <= radiusKm)
      .map((entry) => entry.provider);
  }

  const ids = eligible.map((p) => p.user_id);
  const [calendarRows, engagements] = await Promise.all([
    Workflow.listUnavailableSlotsFor(ids, date),
    Request.listActiveEngagementsOnDate(ids, date),
  ]);
  const blockedByProvider = new Map();
  calendarRows.forEach((row) => {
    const slot = to24hSlot(String(row.slot).slice(0, 5)) || to24hSlot(row.slot);
    if (!slot) return;
    if (!blockedByProvider.has(row.provider_id)) blockedByProvider.set(row.provider_id, new Set());
    blockedByProvider.get(row.provider_id).add(slot);
  });

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const slots = APPOINTMENT_SLOTS_24.map((slot) => {
    const past = date < today || (date === today && Number(slot.slice(0, 2)) <= now.getHours());
    const available = !past && eligible.some((provider) => {
      const blocked = blockedByProvider.get(provider.user_id) || new Set();
      if (isWholeDayBlocked(blocked) || blocked.has(slot)) return false;
      return !engagements.some((engagement) => {
        if (engagement.provider_id !== provider.user_id) return false;
        const bookedSlot = to24hSlot(engagement.time);
        return !bookedSlot || bookedSlot === slot;
      });
    });
    return { time: formatAppointmentSlot(slot), value: slot, available };
  });

  res.json({ date, appointmentHours: APPOINTMENT_HOURS, slots });
});

// GET /api/service-providers/recommended?category&latitude&longitude&preferredDate&preferredTime&exclude
// Mobile step 3 (RecommendServiceProvider.js): unlike recommendedProviders above, the
// request row does not exist yet (it is created on submit), so the draft's category,
// coordinates and preferred schedule arrive as query params. Verified providers only,
// filtered by the request's service category (specialization match) and by
// availability on the preferred schedule, then ranked by rating and distance.

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
  // The draft's preferred schedule: providers who can't take it are excluded below.
  const preferredDate = toIsoDateOrNull(req.query.preferredDate);
  const preferredSlot = to24hSlot(req.query.preferredTime);
  // Radius feature: how far the customer chose to look on the map in CreateServiceRequest
  // (?radiusKm=, else the default) and where the repair happens ('home' | 'shop').
  const radiusKm = clampRadiusKm(req.query.radiusKm, DEFAULT_CUSTOMER_RADIUS_KM);
  const locationType = toLocationTypeOrNull(req.query.serviceLocationType);
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
  const [users, ratings, unavailable] = await Promise.all([
    Request.findUsersByIds(candidates.map((p) => p.user_id)),
    Request.listRatingsForProviders(candidates.map((p) => p.user_id)),
    unavailableForSchedule(candidates.map((p) => p.user_id), preferredDate, preferredSlot),
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
        available: !unavailable.has(p.user_id),
        availabilitySchedule: p.availability || null,
        rating: rating ? Math.round(rating.rating * 10) / 10 : null,
        reviewCount: rating?.reviewCount || 0,
        experienceYears: p.years_of_experience ?? null,
        offersHomeServices: Boolean(p.offers_home_service),
        // How far this provider travels for home service; null when they don't offer it.
        homeServiceRadiusKm: p.offers_home_service ? p.home_service_radius_km ?? DEFAULT_PROVIDER_RADIUS_KM : null,
        // profile_photo is a private storage path; sign it so the app can render it.
        photoUrl: await getProviderFileUrl(p.profile_photo),
        locationName: address,
        distanceKm,
        matchesCategory: wanted ? p.specializations.includes(wanted) : false,
      };
    })
  );

  // Providers who can't take the preferred schedule are never shown (the screen
  // answers with its "No Service Provider Available" state when nobody is left).
  const availableList = preferredDate ? list.filter((p) => p.available) : list;

  // Radius rule. A provider is shown when the distance is within the customer's radius and,
  // for a HOME-based request, they offer home service and the distance is also within THEIR
  // own home-service range. Shop-based: only the customer's radius matters (they travel).
  // A provider whose address could not be geocoded (distanceKm null) is still listed, as before.
  const offersRequestedService = (p) => locationType !== 'home' || p.offersHomeServices;
  const withinReach = (p, limitKm) =>
    p.distanceKm === null ||
    (p.distanceKm <= limitKm &&
      (locationType !== 'home' || p.distanceKm <= (p.homeServiceRadiusKm ?? DEFAULT_PROVIDER_RADIUS_KM)));
  const inRangeList = availableList.filter((p) => offersRequestedService(p) && withinReach(p, radiusKm));

  // Filter by the service category; if nobody matches, fall back to all verified
  // providers so the screen never dead-ends. Rank by rating, then distance.
  const matching = inRangeList.filter((p) => p.matchesCategory);
  const pool = wanted && matching.length > 0 ? matching : inRangeList;
  pool.sort(
    (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
  );

  // Nobody in range: tell the app how far the nearest provider who WOULD appear after widening is,
  // so it can say "Nearest provider is 38 km away. Widen your search?".
  const reachableIfWidened = availableList.filter(
    (p) => offersRequestedService(p) && p.distanceKm !== null && !withinReach(p, radiusKm) && withinReach(p, MAX_RADIUS_KM)
  );
  const nearestProviderKm =
    pool.length === 0 && reachableIfWidened.length > 0 ? Math.min(...reachableIfWidened.map((p) => p.distanceKm)) : null;

  res.json({ providers: pool, radiusKm, nearestProviderKm });
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
  // Instant in-app notification + push for each chosen provider (see Notifications.jsx).
  await notifyProvidersOfNewRequest(row, providerIds);
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

// Returns (row) => km from this provider's workplace to the request's pin, or null when unknown.
// The provider's company_address is geocoded (cached) like in recommendedForDraft.
const providerDistanceTo = async (providerUserId) => {
  const profile = await Provider.findProfile(providerUserId);
  const point = profile?.company_address ? await geocodeAddress(profile.company_address) : null;
  return (row) =>
    point && row.latitude != null && row.longitude != null
      ? Math.round(haversineKm(Number(row.latitude), Number(row.longitude), point.lat, point.lng) * 10) / 10
      : null;
};

// Optional ?filter= used by the mobile Incoming Requests tabs: 'new' = waiting on this provider,
// 'pending' = quotation sent (waiting on the customer), 'all' = both. The web sends no filter,
// which is 'all' - exactly the old behaviour.
// If workflow_controllers.js moves a request to another recipient status after "accept", add it here.
// 'closed' = declined by this provider or the customer declined the quotation.
// 'everything' is what the web list asks for (the mobile app keeps using new / pending / all).
const INCOMING_FILTER_STATUSES = {
  all: ['sent', 'quoted'],
  everything: ['sent', 'quoted', 'declined'],
  new: ['sent'],
  pending: ['quoted'],
  closed: ['declined'],
};

// GET /api/providers/requests[?filter=all|new|pending] -> { requests: [...] } (shape of IncomingServiceRequest.jsx)
const listIncoming = asyncHandler(async (req, res) => {
  const filter = String(req.query.filter || 'all').toLowerCase();
  const statuses = INCOMING_FILTER_STATUSES[filter] || INCOMING_FILTER_STATUSES.all;
  const recipients = await Request.listRecipientsForProvider(req.user.user_id, statuses);
  const rows = await Request.findByIds(recipients.map((r) => r.request_id));
  const byId = Object.fromEntries(rows.map((r) => [r.request_id, r]));
  const customers = await Request.findUsersByIds(rows.map((r) => r.customer_id));
  const quoteRows = await Request.listQuotationsForProvider(
    req.user.user_id,
    recipients.map((r) => r.request_id)
  );
  const quoteByRequest = Object.fromEntries(quoteRows.map((q) => [q.request_id, q]));
  const distanceTo = await providerDistanceTo(req.user.user_id);

  res.json({
    requests: recipients
      .filter((r) => byId[r.request_id])
      .map((r) => {
        const row = byId[r.request_id];
        return toIncomingDto(row, r, customers[row.customer_id], quoteByRequest[r.request_id], distanceTo(row));
      }),
  });
});

// GET /api/providers/requests/:requestId -> { request: {...} } (shape of ServiceRequestDetails.jsx)
const getIncoming = asyncHandler(async (req, res) => {
  const { row, recipient } = await getIncomingPair(req);
  const [customers, attachmentMap, distanceTo, quoteRows] = await Promise.all([
    Request.findUsersByIds([row.customer_id]),
    Request.attachmentsFor([row.request_id]),
    providerDistanceTo(req.user.user_id),
    Request.listQuotationsForProvider(req.user.user_id, [row.request_id]),
  ]);
  res.json({
    request: toDetailsDto(
      row,
      recipient,
      customers[row.customer_id],
      attachmentMap[row.request_id] || [],
      distanceTo(row),
      quoteRows[0] || null
    ),
  });
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
    service_fee: serviceFeeFor(labor, parts), // saved now, so a later rate change never alters this quotation
    remarks: String(req.body.notes || '').trim() || null,
  });
  const updated = await Request.updateRecipient(row.request_id, req.user.user_id, {
    status: 'quoted',
    responded_at: new Date().toISOString(),
  });
  await Workflow.notify({
    userId: row.customer_id,
    type: 'quotation_received',
    message: `You received a quotation for ${Request.formatRequestId(row.request_number)}: PHP ${(labor + parts).toFixed(2)}.`,
    requestId: row.request_id,
  });
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
  await Workflow.notify({
    userId: row.customer_id,
    type: 'request_declined',
    message: `A service provider declined ${Request.formatRequestId(row.request_number)}: ${reason}`,
    requestId: row.request_id,
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
const TIME_SLOTS = APPOINTMENT_SLOTS_24.map(formatAppointmentSlot);

const listTimeSlots = (req, res) => {
  res.json({ timeSlots: TIME_SLOTS.map((label) => ({ value: label, label })) });
};

// GET /api/service-requests/options -> everything the WEB "Creating Service Request" form offers,
// so CreateServiceRequest.jsx has nothing hard-coded (getServiceRequestOptions in api/client.js).
// Register it BEFORE '/:requestId' in servicerequest_routes.js.
//   categories / locationTypes: [{ value, label }] — `value` is what the form sends back.
//   searchRadius: the slider's range and start value (same limits the recommendations enforce).
//   defaultMapCenter: where the map opens until the browser location resolves; set DEFAULT_MAP_LAT
//   and DEFAULT_MAP_LNG in the server environment (null when they are not set).
const LOCATION_TYPES = [
  { value: 'home', label: 'Home-based' },
  { value: 'shop', label: 'Shop-based' },
];

const listCreateOptions = (req, res) => {
  const lat = toNumberOrNull(process.env.DEFAULT_MAP_LAT);
  const lng = toNumberOrNull(process.env.DEFAULT_MAP_LNG);
  res.json({
    categories: CATEGORIES.map((label) => ({ value: label, label })),
    locationTypes: LOCATION_TYPES,
    timeSlots: TIME_SLOTS,
    appointmentHours: APPOINTMENT_HOURS,
    searchRadius: {
      minKm: MIN_RADIUS_KM,
      maxKm: MAX_RADIUS_KM,
      defaultKm: DEFAULT_CUSTOMER_RADIUS_KM,
    },
    defaultMapCenter: lat !== null && lng !== null ? { lat, lng } : null,
    uploadLimits: { maxImages: 4, maxVideos: 1, maxImageMb: 5, maxVideoMb: 50 },
  });
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

// POST /api/service-requests/videos (multipart, field "video") -> { video: { path } }
// Uses the same private bucket and attachment flow as photos, with a 50 MB route limit.
const uploadVideo = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, 'Attach a video');
  const path = await Request.uploadPhoto(req.user.user_id, req.file);
  res.status(201).json({ video: { path } });
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

// Points on a circle of `radiusKm` around (lat, lon), as "lat,lon" strings. The ring is closed
// (last point = first) so Google Static Maps can fill it.
const circlePoints = (lat, lon, radiusKm, steps = 48) => {
  const angular = radiusKm / 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const lat1 = toRad(lat);
  const lon1 = toRad(lon);
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const bearing = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
    );
    const lon2 =
      lon1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
      );
    points.push(`${toDeg(lat2).toFixed(5)},${toDeg(lon2).toFixed(5)}`);
  }
  return points;
};

// GET /api/location/radius-map?latitude&longitude&radiusKm -> { mapImageUri }
// The "search area" picture shown when the customer taps the map on CreateServiceRequest: the
// customer's pin plus a translucent circle of radiusKm. center/zoom are left out on purpose, so
// Google fits the map to the circle. mapImageUri is null when no Maps key is configured.
const radiusMap = asyncHandler(async (req, res) => {
  const lat = Number(req.query.latitude);
  const lon = Number(req.query.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new ApiError(400, 'latitude and longitude are required');
  }
  const radiusKm = clampRadiusKm(req.query.radiusKm, DEFAULT_CUSTOMER_RADIUS_KM);

  const mapsKey = config.googleMaps.apiKey;
  if (!mapsKey) return res.json({ mapImageUri: null, radiusKm });

  const ring = circlePoints(lat, lon, radiusKm).join('%7C');
  const mapImageUri =
    'https://maps.googleapis.com/maps/api/staticmap?size=600x400&scale=2&maptype=roadmap' +
    `&markers=color:0x0255AF%7C${lat},${lon}` +
    `&path=color:0x0255AFff%7Cfillcolor:0x0255AF33%7Cweight:2%7C${ring}` +
    `&key=${mapsKey}`;
  return res.json({ mapImageUri, radiusKm });
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
  // Without a key mapImageUri stays null and the app shows the address/coordinates —
  // set GOOGLE_MAPS_API_KEY on the deployed server (Render -> Environment) so the
  // release app gets the map image too. (No keyless fallback: the only free OSM
  // static-map service, staticmap.openstreetmap.de, no longer exists.)
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
  cancelDraft,
  resolve,
  recommendedProviders,
  recommendedForDraft,
  getAppointmentSlots,
  submit,
  listIncoming,
  getIncoming,
  sendQuote,
  rejectRequest,
  listCategories,
  listTimeSlots,
  listCreateOptions,
  uploadPhoto,
  uploadVideo,
  diagnoseDraft,
  reverseGeocode,
  radiusMap,
  providerDistanceTo, // used by workflow_controllers.js (Active Jobs > Quotation distance)
};