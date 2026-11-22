// api/report_api.js
// Submits "Report a Problem" tickets to the backend so they appear on the Admin side.
//
// BACKEND CONTRACT (see notes in the reply):
//   POST /reports   (multipart/form-data, authenticated)
//     fields : type ('system_error' | 'user_report'), subject, details,
//              reporter_role ('customer' | 'service_provider'),
//              reported_user_name (user reports),
//              reported_user_id (optional), service_request_id (optional)
//     files  : images (0-4), video (0-1)
//
// `client` is the shared axios instance (api/client.js) that already adds the
// base URL and the auth token. If your client.js is fetch-based, only the single
// `client.post(...)` call below needs adapting.
import client from './client';

// Values the backend/Admin side filters on. Must match the backend enum.
export const REPORT_TYPES = {
    SYSTEM_ERROR: 'system_error',
    USER_REPORT: 'user_report',
};

// Which side of the app the report was filed from (one account holds both roles).
export const REPORTER_ROLES = {
    CUSTOMER: 'customer',
    SERVICE_PROVIDER: 'service_provider',
};

// Same limits as Create Service Request / Update Status.
export const MEDIA_LIMITS = {
    MAX_IMAGES: 4,
    MAX_VIDEOS: 1,
};

export const submitReport = async ({
    type,
    subject,
    details,
    media = [],
    reportedUserId,
    reportedUserName,
    serviceRequestId,
    reporterRole = REPORTER_ROLES.CUSTOMER,
}) => {
    const form = new FormData();
    form.append('type', type);
    form.append('subject', subject);
    form.append('details', details);
    form.append('reporter_role', reporterRole);
    if (reportedUserName) form.append('reported_user_name', reportedUserName);
    if (reportedUserId) form.append('reported_user_id', String(reportedUserId));
    if (serviceRequestId) form.append('service_request_id', String(serviceRequestId));

    media.forEach((m) => {
        form.append(m.kind === 'video' ? 'video' : 'images', {
            uri: m.uri,
            name: m.name,
            type: m.type,
        });
    });

    try {
        const res = await client.post('/reports', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
    } catch (err) {
        const message =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            'Something went wrong. Please try again.';
        throw new Error(message);
    }
};