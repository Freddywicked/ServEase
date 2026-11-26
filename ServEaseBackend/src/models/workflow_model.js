// src/models/workflow_model.js
// Data access for the core customer <-> provider workflow tables, created by
// migrations/002_core_workflow_tables.sql:
//   notifications, schedule_proposals, payment_requests, progress_updates,
//   payments, ratings, messages, provider_unavailable_slots
const { supabase } = require('../config/supabase');
const { unwrap } = require('../utils/db');

// ---------- notifications ----------
const addNotification = async ({ userId, type = 'general', message, requestId = null }) =>
  unwrap(
    await supabase
      .from('notifications')
      .insert({ user_id: userId, type, message, request_id: requestId })
      .select()
      .single()
  );

// Mobile routes use the public SR-0007 reference, while notifications store the
// request UUID. Keep requestId unchanged for compatibility and add requestRef to
// the push payload, matching GET /notifications' requestId value.
const requestRefForPush = async (requestId) => {
  if (!requestId) return '';
  if (/^SR-\d+$/i.test(String(requestId))) return String(requestId);
  const Request = require('./servicerequest_model');
  const rows = await Request.findByIds([requestId]);
  return rows[0] ? Request.formatRequestId(rows[0].request_number) : '';
};

// Best-effort: a notification must never break the action that triggered it.
// Also fires the FCM push (utils/push.js) — lazy require so the two modules can
// reference each other without a load-time cycle.
const notify = (args) =>
  addNotification(args)
    .then(async (row) => {
      const requestRef = await requestRefForPush(args.requestId).catch((err) => {
        console.error('[notify] request reference lookup failed:', err.message);
        return '';
      });
      require('../utils/push')
        .sendPushToUser(args.userId, {
          title: 'ServEase',
          body: args.message,
          data: {
            type: args.type || 'general',
            requestId: args.requestId || '',
            requestRef,
            notificationId: row.notification_id,
          },
        })
        .catch((err) => console.error('[push]', err.message));
      return row;
    })
    .catch((err) => console.error('[notify]', err.message));

const listNotifications = async (userId, limit = 20) =>
  unwrap(
    await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(Number(limit) || 20, 100))
  );

// Marks one notification read. Scoped to the owner so one user cannot touch
// another's rows. Best-effort: a failure must not break the app.
const markNotificationRead = async (notificationId, userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('notification_id', notificationId)
    .eq('user_id', userId);
  if (error) console.error('[notifications] mark read failed:', error.message);
};

// ---------- schedule_proposals ----------
const addScheduleProposal = async (row) =>
  unwrap(await supabase.from('schedule_proposals').insert(row).select().single());

const findScheduleProposal = async (proposalId) =>
  unwrap(await supabase.from('schedule_proposals').select('*').eq('proposal_id', proposalId).maybeSingle());

const updateScheduleProposal = async (proposalId, patch) =>
  unwrap(await supabase.from('schedule_proposals').update(patch).eq('proposal_id', proposalId).select().single());

const listScheduleProposals = async (requestIds) => {
  if (!requestIds.length) return [];
  return unwrap(await supabase.from('schedule_proposals').select('*').in('request_id', requestIds));
};

// ---------- payment_requests ----------
const addPaymentRequest = async (row) =>
  unwrap(await supabase.from('payment_requests').insert(row).select().single());

const findPaymentRequest = async (paymentRequestId) =>
  unwrap(await supabase.from('payment_requests').select('*').eq('payment_request_id', paymentRequestId).maybeSingle());

const updatePaymentRequest = async (paymentRequestId, patch) =>
  unwrap(
    await supabase.from('payment_requests').update(patch).eq('payment_request_id', paymentRequestId).select().single()
  );

const listPaymentRequests = async (requestIds) => {
  if (!requestIds.length) return [];
  return unwrap(await supabase.from('payment_requests').select('*').in('request_id', requestIds));
};

// Price negotiations still waiting on this provider: the customer answered an additional
// payment with a counter-offer (columns from migrations/007_payment_request_negotiation.sql).
const listNegotiatingPaymentRequests = async (providerId) =>
  unwrap(
    await supabase
      .from('payment_requests')
      .select('*')
      .eq('provider_id', providerId)
      .eq('status', 'pending')
      .eq('negotiation_status', 'requested')
      .order('negotiated_at', { ascending: false })
  );

// ---------- progress_updates ----------
const addProgressUpdate = async (row) =>
  unwrap(await supabase.from('progress_updates').insert(row).select().single());

const listProgressUpdates = async (requestIds) => {
  if (!requestIds.length) return [];
  return unwrap(
    await supabase.from('progress_updates').select('*').in('request_id', requestIds).order('created_at')
  );
};

// ---------- payments ----------
const addPayment = async (row) => unwrap(await supabase.from('payments').insert(row).select().single());

const listPayments = async (requestIds) => {
  if (!requestIds.length) return [];
  return unwrap(await supabase.from('payments').select('*').in('request_id', requestIds).order('created_at'));
};

const findPaymentById = async (paymentId) =>
  unwrap(await supabase.from('payments').select('*').eq('payment_id', paymentId).maybeSingle());

const findPaymentByCheckoutId = async (checkoutSessionId) =>
  unwrap(
    await supabase.from('payments').select('*').eq('checkout_session_id', checkoutSessionId).maybeSingle()
  );

const updatePayment = async (paymentId, patch) =>
  unwrap(await supabase.from('payments').update(patch).eq('payment_id', paymentId).select().single());

// The newest payment attempt on a request (the Payment screen polls its status).
const latestPaymentForRequest = async (requestId) =>
  unwrap(
    await supabase
      .from('payments')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  );

// ---------- ratings ----------
// The sentiment column arrives with migration 006; databases that have not run
// it yet reject the unknown column (PGRST204 / 42703). Retry without it so the
// rating itself is never lost over the sentiment label.
const addRating = async (row) => {
  const { data, error } = await supabase.from('ratings').insert(row).select().single();
  if (error && (error.code === 'PGRST204' || error.code === '42703') && 'sentiment' in row) {
    const { sentiment, ...withoutSentiment } = row;
    return unwrap(await supabase.from('ratings').insert(withoutSentiment).select().single());
  }
  return unwrap({ data, error });
};

const findRatingForRequest = async (requestId) =>
  unwrap(await supabase.from('ratings').select('*').eq('request_id', requestId).maybeSingle());


// ---------- messages ----------
const addMessage = async (row) => unwrap(await supabase.from('messages').insert(row).select().single());

const listMessages = async (requestId) =>
  unwrap(await supabase.from('messages').select('*').eq('request_id', requestId).order('created_at'));

const listMessagesForRequests = async (requestIds) => {
  if (!requestIds.length) return [];
  return unwrap(await supabase.from('messages').select('*').in('request_id', requestIds).order('created_at'));
};

// viewer: 'customer' | 'provider' — marks every message in the thread seen by that side.
const markMessagesSeen = async (requestId, viewer) => {
  const column = viewer === 'provider' ? 'seen_by_provider' : 'seen_by_customer';
  const { error } = await supabase.from('messages').update({ [column]: true }).eq('request_id', requestId);
  if (error) console.error('[messages] mark seen failed:', error.message);
};

// ---------- provider_unavailable_slots ----------
const listUnavailableSlots = async (providerId) =>
  unwrap(await supabase.from('provider_unavailable_slots').select('date, slot').eq('provider_id', providerId));

// Which of these providers marked a given date ('YYYY-MM-DD') unavailable, and at
// which slots. Error-tolerant like the ratings reads: no table -> everyone available.
const listUnavailableSlotsFor = async (providerIds, date) => {
  const ids = [...new Set(providerIds.filter(Boolean))];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('provider_unavailable_slots')
    .select('provider_id, slot')
    .in('provider_id', ids)
    .eq('date', date);
  if (error || !data) return [];
  return data;
};

const setUnavailableSlot = async (providerId, date, slot, unavailable) => {
  if (unavailable) {
    const { error } = await supabase
      .from('provider_unavailable_slots')
      .upsert({ provider_id: providerId, date, slot }, { onConflict: 'provider_id,date,slot' });
    if (error) unwrap({ error });
    return;
  }
  unwrap(
    await supabase
      .from('provider_unavailable_slots')
      .delete()
      .eq('provider_id', providerId)
      .eq('date', date)
      .eq('slot', slot)
  );
};

// ---------- device_tokens (FCM) ----------
// A token belongs to whoever registered it most recently (a phone can change hands
// between logins), so upsert re-assigns the user_id.
const upsertDeviceToken = async (userId, fcmToken, platform = 'android') =>
  unwrap(
    await supabase
      .from('device_tokens')
      .upsert({ fcm_token: fcmToken, user_id: userId, platform, updated_at: new Date().toISOString() })
      .select()
      .single()
  );

const deleteDeviceToken = async (fcmToken) => {
  const { error } = await supabase.from('device_tokens').delete().eq('fcm_token', fcmToken);
  if (error) console.error('[devices] delete failed:', error.message);
};

const listDeviceTokens = async (userId) => {
  // A closed app cannot revoke its own token when the seven-day rolling
  // session expires. Enforce the same inactivity window on the server so stale
  // devices stop receiving account pushes even if they never reopen the app.
  const activeSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('device_tokens')
    .select('fcm_token')
    .eq('user_id', userId)
    .gte('updated_at', activeSince);
  if (error) return []; // table missing (migration 004 not run) -> just skip pushes
  return (data || []).map((r) => r.fcm_token);
};

module.exports = {
  addNotification,
  notify,
  listNotifications,
  markNotificationRead,
  upsertDeviceToken,
  deleteDeviceToken,
  listDeviceTokens,
  addScheduleProposal,
  findScheduleProposal,
  updateScheduleProposal,
  listScheduleProposals,
  addPaymentRequest,
  findPaymentRequest,
  updatePaymentRequest,
  listPaymentRequests,
  listNegotiatingPaymentRequests,
  addProgressUpdate,
  listProgressUpdates,
  addPayment,
  listPayments,
  findPaymentById,
  findPaymentByCheckoutId,
  updatePayment,
  latestPaymentForRequest,
  addRating,
  findRatingForRequest,
  addMessage,
  listMessages,
  listMessagesForRequests,
  markMessagesSeen,
  listUnavailableSlots,
  listUnavailableSlotsFor,
  setUnavailableSlot,
};