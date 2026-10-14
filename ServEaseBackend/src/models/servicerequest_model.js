// src/models/servicerequest_model.js
// Data access for SERVICE_REQUEST and the tables around it, matching the ERD
// (see migrations/001_align_schema_with_erd.sql):
//   service_requests              - the request; request_number is the human-facing "SR-0007"
//   service_request_providers     - junction: which providers a request was sent to
//   quotations                    - a provider's quote for a request
//   service_request_attachments   - photos attached to the request
const { supabase } = require('../config/supabase');
const { unwrap } = require('../utils/db');
const { uploadServiceRequestPhoto, getServiceRequestPhotoUrl } = require('../utils/storage');

const REQUESTS = 'service_requests';
const RECIPIENTS = 'service_request_providers';
const QUOTATIONS = 'quotations';
const ATTACHMENTS = 'service_request_attachments';

// 7 -> "SR-0007", "SR-0007" -> 7
const formatRequestId = (requestNo) => `SR-${String(requestNo).padStart(4, '0')}`;
const parseRequestId = (value) => {
  const match = /^SR-(\d+)$/i.exec(String(value).trim());
  return match ? Number(match[1]) : null;
};

// ---------- service_requests ----------
const create = async (row) => unwrap(await supabase.from(REQUESTS).insert(row).select().single());

const findByRequestNo = async (requestNo) =>
  unwrap(await supabase.from(REQUESTS).select('*').eq('request_number', requestNo).maybeSingle());

const findByIds = async (requestIds) => {
  if (requestIds.length === 0) return [];
  return unwrap(await supabase.from(REQUESTS).select('*').in('request_id', requestIds));
};

const update = async (requestNo, patch) =>
  unwrap(
    await supabase
      .from(REQUESTS)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('request_number', requestNo)
      .select()
      .single()
  );

// Everything past the draft stage, newest first (Track Requests / History).
const listForCustomer = async (customerUserId) =>
  unwrap(
    await supabase
      .from(REQUESTS)
      .select('*')
      .eq('customer_id', customerUserId)
      .neq('request_status', 'New')
      .order('created_at', { ascending: false })
  );

// ---------- service_request_providers (who a request was sent to) ----------
const addRecipients = async (requestId, providerUserIds) =>
  unwrap(
    await supabase
      .from(RECIPIENTS)
      .insert(providerUserIds.map((id) => ({ request_id: requestId, provider_id: id })))
      .select()
  );

const listRecipients = async (requestId) =>
  unwrap(await supabase.from(RECIPIENTS).select('*').eq('request_id', requestId));

const listRecipientsForProvider = async (providerUserId, statuses) =>
  unwrap(
    await supabase
      .from(RECIPIENTS)
      .select('*')
      .eq('provider_id', providerUserId)
      .in('status', statuses)
      .order('sent_at', { ascending: false })
  );

const findRecipient = async (requestId, providerUserId) =>
  unwrap(
    await supabase
      .from(RECIPIENTS)
      .select('*')
      .eq('request_id', requestId)
      .eq('provider_id', providerUserId)
      .maybeSingle()
  );

const updateRecipient = async (requestId, providerUserId, patch) =>
  unwrap(
    await supabase
      .from(RECIPIENTS)
      .update(patch)
      .eq('request_id', requestId)
      .eq('provider_id', providerUserId)
      .select()
      .single()
  );

// ---------- quotations ----------
const addQuotation = async ({ request_id, provider_id, labor_cost, parts_cost, remarks }) =>
  unwrap(
    await supabase
      .from(QUOTATIONS)
      .insert({ request_id, provider_id, labor_cost, parts_cost, remarks })
      .select()
      .single()
  );

const listQuotations = async (requestId) =>
  unwrap(await supabase.from(QUOTATIONS).select('*').eq('request_id', requestId));

const listQuotationsForProvider = async (providerUserId, requestIds) => {
  if (requestIds.length === 0) return [];
  return unwrap(
    await supabase.from(QUOTATIONS).select('*').eq('provider_id', providerUserId).in('request_id', requestIds)
  );
};

// ---------- service_request_attachments ----------
const addAttachment = async ({ request_id, file_url, filename }) =>
  unwrap(await supabase.from(ATTACHMENTS).insert({ request_id, file_url, filename }).select().single());

// { [request_id]: [signedUrl, ...] } — file_url stores a private storage path, so
// each photo is signed on the way out (same approach as the admin document viewer).
const photoUrlsFor = async (requestIds) => {
  if (requestIds.length === 0) return {};
  const rows = unwrap(await supabase.from(ATTACHMENTS).select('*').in('request_id', requestIds));
  const map = {};
  for (const row of rows) {
    const url = await getServiceRequestPhotoUrl(row.file_url);
    if (url) (map[row.request_id] ||= []).push(url);
  }
  return map;
};

// ---------- users / providers ----------
// { [user_id]: { user_id, name, address } }
const findUsersByIds = async (userIds) => {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const rows = unwrap(await supabase.from('users').select('user_id, name, address').in('user_id', ids));
  return Object.fromEntries(rows.map((u) => [u.user_id, u]));
};

// Verified providers, each with its specialization names and home-service flag
// gathered from service_provider_specialization (one row per category/service).
const listVerifiedProviders = async () => {
  const providers = unwrap(
    await supabase
      .from('service_providers')
      .select('user_id, years_of_experience, profile_photo, availability, company_name, company_address')
      .eq('verification_status', 'verified')
  );
  if (providers.length === 0) return [];

  const specs = unwrap(
    await supabase
      .from('service_provider_specialization')
      .select('provider_id, specialization_name, offers_home_service')
      .in(
        'provider_id',
        providers.map((p) => p.user_id)
      )
  );
  const byProvider = {};
  for (const s of specs) (byProvider[s.provider_id] ||= []).push(s);

  return providers.map((p) => ({
    ...p,
    specializations: (byProvider[p.user_id] || []).map((s) => s.specialization_name),
    offers_home_service: (byProvider[p.user_id] || []).some((s) => s.offers_home_service),
  }));
};

// Average rating + review count per provider: { [provider_id]: { rating, reviewCount } }.
// The ratings table is optional (not part of the base schema yet), so any error —
// including "table does not exist" — just means "no ratings yet", never a failed request.
const listRatingsForProviders = async (providerIds) => {
  const ids = [...new Set(providerIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const { data, error } = await supabase.from('ratings').select('provider_id, rating').in('provider_id', ids);
  if (error || !data) return {};
  const byProvider = {};
  for (const row of data) {
    const value = Number(row.rating);
    if (!Number.isFinite(value)) continue;
    (byProvider[row.provider_id] ||= []).push(value);
  }
  return Object.fromEntries(
    Object.entries(byProvider).map(([id, values]) => [
      id,
      { rating: values.reduce((sum, n) => sum + n, 0) / values.length, reviewCount: values.length },
    ])
  );
};

// One verified provider by user id, with the same specialization gathering
// listVerifiedProviders does (used by the customer ProviderDetails screen).
const findVerifiedProviderById = async (userId) => {
  const provider = unwrap(
    await supabase
      .from('service_providers')
      .select('user_id, years_of_experience, profile_photo, availability, company_name, company_address')
      .eq('user_id', userId)
      .eq('verification_status', 'verified')
      .maybeSingle()
  );
  if (!provider) return null;

  const specs = unwrap(
    await supabase
      .from('service_provider_specialization')
      .select('specialization_name, offers_home_service')
      .eq('provider_id', userId)
  );

  return {
    ...provider,
    specializations: specs.map((s) => s.specialization_name),
    offers_home_service: specs.some((s) => s.offers_home_service),
  };
};

// Full review rows for one provider (ProviderDetails screen), newest first. Same
// tolerance as listRatingsForProviders: a missing ratings table means "no reviews
// yet", never a failed request. Reviewer names are returned raw — the controller
// masks them before they leave the server.
const listReviewsForProvider = async (providerId) => {
  // select('*') on purpose: ratings tables created before migration 006 have no
  // rating_id column, and naming a missing column fails the whole query in
  // PostgREST — which, combined with the error tolerance below, used to make
  // every provider profile show "no reviews yet" even when ratings existed.
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });
  if (error || !data || data.length === 0) return [];

  const [users, requests] = await Promise.all([
    findUsersByIds(data.map((r) => r.customer_id)),
    findByIds([...new Set(data.map((r) => r.request_id).filter(Boolean))]),
  ]);
  const categoryByRequest = Object.fromEntries(requests.map((r) => [r.request_id, r.category]));

  return data.map((row) => ({
    id: row.rating_id || row.id || row.request_id,
    reviewerName: users[row.customer_id]?.name || 'Customer',
    rating: row.rating,
    comment: row.review || '',
    sentiment: row.sentiment || null, // 'positive' | 'neutral' | 'negative' (migration 006)
    serviceAvailed: categoryByRequest[row.request_id] || null,
    createdAt: row.created_at,
  }));
};

// Requests already occupying a provider's schedule on a date ('YYYY-MM-DD'):
//   - booked jobs: provider_id is set on the request itself (ERD: "Accepted by")
//     with status Approved / In Progress;
//   - open requests addressed to the provider (service_request_providers row in
//     'sent' / 'quoted' / 'accepted') whose request is still active on that date.
// Returns [{ provider_id, time }] (time is the stored string, e.g. '10:00 AM' or
// 'HH:mm', possibly null). Error-tolerant like listRatingsForProviders: a failed
// read means "nobody is busy", never a failed request.
const listActiveEngagementsOnDate = async (providerIds, date) => {
  const ids = [...new Set(providerIds.filter(Boolean))];
  if (ids.length === 0 || !date) return [];

  const engagements = [];

  const { data: booked, error: bookedError } = await supabase
    .from(REQUESTS)
    .select('provider_id, time')
    .in('provider_id', ids)
    .eq('date', date)
    .in('request_status', ['Approved', 'In Progress']);
  if (!bookedError && booked) engagements.push(...booked);

  const { data: recipients, error: recipientsError } = await supabase
    .from(RECIPIENTS)
    .select('request_id, provider_id')
    .in('provider_id', ids)
    .in('status', ['sent', 'quoted', 'accepted']);
  if (!recipientsError && recipients && recipients.length > 0) {
    const { data: rows, error: rowsError } = await supabase
      .from(REQUESTS)
      .select('request_id, time')
      .in('request_id', [...new Set(recipients.map((r) => r.request_id))])
      .eq('date', date)
      .in('request_status', ['Pending', 'Approved', 'In Progress']);
    if (!rowsError && rows) {
      const timeByRequest = Object.fromEntries(rows.map((r) => [r.request_id, r.time]));
      recipients.forEach((r) => {
        if (Object.prototype.hasOwnProperty.call(timeByRequest, r.request_id)) {
          engagements.push({ provider_id: r.provider_id, time: timeByRequest[r.request_id] });
        }
      });
    }
  }

  return engagements;
};

// ---------- storage ----------
// Uploads the customer's photo to the private request-photos bucket and returns
// its PATH. Store the path in service_request_attachments.file_url; sign a URL
// only when something needs to display the photo (see photoUrlsFor).
const uploadPhoto = (userId, file) => uploadServiceRequestPhoto(userId, file);

module.exports = {
  formatRequestId,
  parseRequestId,
  create,
  findByRequestNo,
  findByIds,
  update,
  listForCustomer,
  addRecipients,
  listRecipients,
  listRecipientsForProvider,
  findRecipient,
  updateRecipient,
  addQuotation,
  listQuotations,
  listQuotationsForProvider,
  addAttachment,
  photoUrlsFor,
  findUsersByIds,
  listVerifiedProviders,
  findVerifiedProviderById,
  listRatingsForProviders,
  listReviewsForProvider,
  listActiveEngagementsOnDate,
  uploadPhoto,
};
