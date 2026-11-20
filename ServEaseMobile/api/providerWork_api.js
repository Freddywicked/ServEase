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
//                 started, currentStepIndex, currentStepLabel }],
//        quotations: [{ id, paymentRequestId, jobId, requestNumber, customerName, createdAt,
//                       distanceKm|null, statusLabel, originalAmount, proposedAmount|null, customerMessage }] }
// `quotations` = customer price negotiations waiting for this provider (Jobs > Active > Quotations).
export const getProviderJobs = () => request('/provider/jobs');

// GET /provider/jobs/:id
//   -> { job: { id, currentStage, stages: ['Assessing', ...], stageOptions: [{ value, label }],
//               serviceLocationType } }
// Shop-based and home-based requests have different stage lists; the backend decides.
export const getProviderJob = (jobId) => request(`/provider/jobs/${jobId}`);

// Photos: up to 4 (5 MB each). Video: up to 1 (50 MB). Keep in sync with the backend limits.
export const MAX_UPDATE_IMAGES = 4;
export const MAX_UPDATE_VIDEOS = 1;

// PATCH /provider/jobs/:id/status  { stage, notes, photos[]?, video? }
// `media` is [{ uri, type, fileName, isVideo }] from JobUpdateStatus. With media the body is
// multipart (photos repeat the "photos" field, the video uses "video"); without it, plain JSON.
export const updateJobStatus = (jobId, { stage, notes, media = [] }) => {
    if (media.length > 0) {
        const form = new FormData();
        form.append('stage', stage);
        form.append('notes', notes || '');
        media.forEach((m, index) => {
            form.append(m.isVideo ? 'video' : 'photos', {
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

// Customer price negotiation on an additional payment.
// POST /provider/negotiations/:paymentRequestId/accept   -> the amount becomes the customer's suggestion
// POST /provider/negotiations/:paymentRequestId/reject   { reason }
export const acceptNegotiation = (paymentRequestId) =>
    request(`/provider/negotiations/${paymentRequestId}/accept`, { method: 'POST' });
export const rejectNegotiation = (paymentRequestId, reason) =>
    request(`/provider/negotiations/${paymentRequestId}/reject`, { method: 'POST', body: { reason } });

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

// ------------------------------------------------------------ Earnings
// GET /provider/earnings
//   -> { summary: { thisWeek, pendingPayment },
//        transactions: [{ id, requestNumber, customerName, date, amount }] }
// Amounts are plain numbers (pesos); `date` is an ISO string.
export const getProviderEarnings = () => request('/provider/earnings');