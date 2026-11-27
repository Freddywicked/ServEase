// Service Provider API calls for the Jobs, Messages and Earnings screens.
//
// `request(path, options)` is assumed to be the authenticated fetch helper from
// api/client.js (adds the auth token, parses JSON, throws an error with `.status`
// on non-2xx). It must pass a FormData body through untouched (no JSON stringify,
// no forced Content-Type) for the photo upload in updateJobStatus. If your helper
// is named or shaped differently, only this file needs adjusting.
import { request } from './client';

// ---------------------------------------------------------------- Jobs
// GET /provider/jobs
//   -> { jobs: [{ id, requestNumber, customerName, createdAt, status ('Active'|'Pending'|'Done'),
//                 statusLabel, aiSuggestion, stages: ['Assessing', ...], stageLabels, serviceLocationType,
//                 started, currentStepIndex, currentStepLabel }] }
export const getProviderJobs = () => request('/provider/jobs');

// GET /provider/jobs/:id
//   -> { job: { id, currentStage, stages: ['Assessing', ...], stageOptions: [{ value, label }],
//               serviceLocationType } }
// Shop-based and home-based requests have different stage lists; the backend decides.
export const getProviderJob = (jobId) => request(`/provider/jobs/${jobId}`);

// Photos and videos share one pool of 5 attachments. Photos are limited to 5 MB each
// and videos to 50 MB each. Keep in sync with the backend and web limits.
export const MAX_UPDATE_ATTACHMENTS = 5;

// PATCH /provider/jobs/:id/status  { stage, notes, attachments[]? }
// `media` is [{ uri, type, fileName, isVideo }] from JobUpdateStatus. With media the body is
// multipart and every photo or video uses the "attachments" field, just like the web client.
// Without media, plain JSON is sufficient; attachments are always optional.
export const updateJobStatus = (jobId, { stage, notes, media = [] }) => {
    if (media.length > MAX_UPDATE_ATTACHMENTS) {
        throw new Error(`You can attach up to ${MAX_UPDATE_ATTACHMENTS} photos or videos per update.`);
    }
    if (media.length > 0) {
        const form = new FormData();
        form.append('stage', stage);
        form.append('notes', notes || '');
        media.forEach((m, index) => {
            form.append('attachments', {
                uri: m.uri,
                type: m.type || (m.isVideo ? 'video/mp4' : 'image/jpeg'),
                name: m.fileName || `update-${index}.${m.isVideo ? 'mp4' : 'jpg'}`,
            });
        });
        return request(`/provider/jobs/${jobId}/status`, {
            method: 'PATCH',
            body: form,
            timeoutMs: media.some((m) => m.isVideo) ? 180000 : 60000,
        });
    }
    return request(`/provider/jobs/${jobId}/status`, { method: 'PATCH', body: { stage, notes } });
};

// GET /provider/jobs/quotations
// Customer price negotiations are returned separately from the Jobs list, using the same
// endpoint and DTO as the web Active Jobs screen.
export const getProviderJobQuotations = () => request('/provider/jobs/quotations');

// Customer price negotiation on an additional payment.
// POST /provider/jobs/:jobId/payment-requests/:paymentRequestId/negotiation/accept
// POST /provider/jobs/:jobId/payment-requests/:paymentRequestId/negotiation/reject  { reason }
export const acceptNegotiation = (jobId, paymentRequestId) =>
    request(
        `/provider/jobs/${encodeURIComponent(jobId)}/payment-requests/${encodeURIComponent(paymentRequestId)}/negotiation/accept`,
        { method: 'POST' },
    );
export const rejectNegotiation = (jobId, paymentRequestId, reason) =>
    request(
        `/provider/jobs/${encodeURIComponent(jobId)}/payment-requests/${encodeURIComponent(paymentRequestId)}/negotiation/reject`,
        { method: 'POST', body: { reason } },
    );

// POST /provider/jobs/:id/additional-parts  { additionalCost, notes }
// The backend should notify the customer about the extra parts/cost.
export const notifyAdditionalParts = (jobId, { additionalCost, notes }) =>
    request(`/provider/jobs/${jobId}/additional-parts`, {
        method: 'POST',
        body: { additionalCost, notes },
    });

// ------------------------------------------------------------ Messages
// GET /conversations
//   -> { conversations: [{ id, name, avatarUrl, lastMessage, hasUnread, jobTitle, isOnline }] }
export const getConversations = () => request('/conversations');

// GET /conversations/:id/messages  (the backend marks the thread as read for this provider)
//   -> { messages: [{ id, text, sender ('provider'|'customer'), createdAt }] }
export const getConversationMessages = (conversationId) =>
    request(`/conversations/${conversationId}/messages`);

// POST /conversations/:id/messages  { text }  -> { message: { id, text, sender, createdAt } }
export const sendConversationMessage = (conversationId, text) =>
    request(`/conversations/${conversationId}/messages`, { method: 'POST', body: { text } });

// DELETE /conversations/:id  -> 200/204 on success
// Deletes the whole chat (the thread and its messages) from the backend/database. Used by the
// long-press "Do you want to delete this message?" modal on both Messages lists.
// The backend must check that the signed-in user is the customer or provider on this thread.
export const deleteConversation = (conversationId) =>
    request(`/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });

// ------------------------------------------------------------ Earnings
// GET /provider/earnings
//   -> { summary: { thisWeek, pendingPayment },
//        transactions: [{ id, requestNumber, customerName, date, amount }] }
// Amounts are plain numbers (pesos); `date` is an ISO string.
export const getProviderEarnings = () => request('/provider/earnings');