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

// Best-effort: a notification must never break the action that triggered it.
// Also fires the FCM push (utils/push.js) — lazy require so the two modules can
// reference each other without a load-time cycle.
const notify = (args) =>
  addNotification(args)
    .then((row) => {
      require('../utils/push')
        .sendPushToUser(args.userId, {
          title: 'ServEase',
          body: args.message,
          data: { type: args.type || 'general', requestId: args.requestId || '', notificationId: row.notification_id },
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
const addRating = async (row) => unwrap(await supabase.from('ratings').insert(row).select().single());

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
  const { data, error } = await supabase.from('device_tokens').select('fcm_token').eq('user_id', userId);
  if (error) return []; // table missing (migration 004 not run) -> just skip pushes
  return (data || []).map((r) => r.fcm_token);
};

module.exports = {
  addNotification,
  notify,
  listNotifications,
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
  setUnavailableSlot,
};
