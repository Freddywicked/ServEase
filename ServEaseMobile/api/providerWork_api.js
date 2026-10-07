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
//                 statusLabel, aiSuggestion, stages: ['Assessing', ...], currentStepIndex,
//                 currentStepLabel, progressPaymentPaid }] }
export const getProviderJobs = () => request('/provider/jobs');

// GET /provider/jobs/:id  -> { job: { id, currentStage, stages: ['Assessing', 'Repairing', ...] } }
export const getProviderJob = (jobId) => request(`/provider/jobs/${jobId}`);

// PATCH /provider/jobs/:id/status  { stage, notes, photo? (multipart when a photo is attached) }
export const updateJobStatus = (jobId, { stage, notes, photo }) => {
    if (photo) {
        const form = new FormData();
        form.append('stage', stage);
        form.append('notes', notes || '');
        form.append('photo', {
            uri: photo.uri,
            type: photo.type || 'image/jpeg',
            name: photo.fileName || 'job-update.jpg',
        });
        return request(`/provider/jobs/${jobId}/status`, { method: 'PATCH', body: form });
    }
    return request(`/provider/jobs/${jobId}/status`, { method: 'PATCH', body: { stage, notes } });
};

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