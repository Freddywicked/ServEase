// api/providerProfile.js
//
// Loads the signed-in service provider's profile for the Profile screen.
//
// Route this file calls (add it to provider_routes.js, above any "/:id" route):
//   GET /api/providers/me/profile
//
// Response shape (camelCase or snake_case both work, see normalizeProfile):
// {
//   fullName, specialty, yearsExperience, photoUrl,
//   rating, reviewCount,
//   aiSummary: { positiveFeedbackPercent, tags: [] },
//   reviews: [{ id, reviewer (already masked, e.g. "N**** O*ea"), rating, service, comment }],
//   account: { email, address },
//   other: { availabilityDays, availabilityHours, companyAddress, companyName }
// }

// Reuse api/client.js so this module always hits the same base URL
// (dev: localhost via `adb reverse`, prod: the Render deployment), shares the
// stored JWT, and gets the same timeout/error handling as every other screen.
// client.js's BASE_URL already ends in /api, so paths below start at /providers.
import { request } from './client';

const pick = (obj, ...keys) => {
    for (const key of keys) {
        if (obj && obj[key] !== undefined && obj[key] !== null) {
            return obj[key];
        }
    }
    return null;
};

// Turns the backend response into the shape the screen uses.
// Missing values stay null; the screen shows a dash or hides that section.
export function normalizeProfile(raw) {
    const p = raw?.profile ?? raw ?? {};
    const ai = pick(p, 'aiSummary', 'ai_summary') || {};
    const account = p.account || {};
    const other = p.other || {};

    return {
        fullName: pick(p, 'fullName', 'full_name'),
        specialty: pick(p, 'specialty', 'category', 'service_category'),
        yearsExperience: pick(p, 'yearsExperience', 'years_experience'),
        photoUrl: pick(p, 'photoUrl', 'photo_url', 'profile_photo_url'),
        rating: pick(p, 'rating', 'average_rating'),
        reviewCount: pick(p, 'reviewCount', 'review_count') ?? 0,
        aiSummary: {
            positiveFeedbackPercent: pick(ai, 'positiveFeedbackPercent', 'positive_feedback_percent'),
            tags: Array.isArray(ai.tags) ? ai.tags : [],
        },
        reviews: Array.isArray(p.reviews)
            ? p.reviews.map((r, i) => ({
                  id: String(pick(r, 'id') ?? i),
                  reviewer: pick(r, 'reviewer', 'reviewer_name') || '',
                  rating: Number(pick(r, 'rating')) || 0,
                  service: pick(r, 'service', 'service_availed') || '',
                  comment: pick(r, 'comment', 'review') || '',
              }))
            : [],
        account: {
            email: pick(account, 'email') ?? pick(p, 'email'),
            address: pick(account, 'address') ?? pick(p, 'address'),
        },
        other: {
            availabilityDays: pick(other, 'availabilityDays', 'availability_days'),
            availabilityHours: pick(other, 'availabilityHours', 'availability_hours'),
            companyAddress: pick(other, 'companyAddress', 'company_address'),
            companyName: pick(other, 'companyName', 'company_name'),
        },
    };
}

export async function fetchMyProviderProfile() {
    return normalizeProfile(await request('/providers/me/profile'));
}

// PATCH /api/providers/me/profile  (send only the fields that changed)
//   email, address                 -> the account's email / address
//   availabilityDays               -> array of 'Mon' | 'Tue' | ... | 'Sun'
//   availabilityHours              -> string like '9:00 AM - 5:00 PM' (null clears it)
//   companyName, companyAddress    -> provider company details
// BACKEND: add this route next to GET /providers/me/profile (above any "/:id" route),
// validate the email (unique), save, and return the updated profile.
export async function updateMyProviderProfile(fields) {
    return normalizeProfile(
        await request('/providers/me/profile', { method: 'PATCH', body: fields })
    );
}

// POST /api/providers/me/photo  (multipart, field "photo") -> { photoUrl }
// BACKEND: store the file (e.g. Supabase Storage) and save the URL on the provider.
export function uploadMyProviderPhoto(uri, fileName, mimeType) {
    const form = new FormData();
    form.append('photo', {
        uri,
        name: fileName || 'profile.jpg',
        type: mimeType || 'image/jpeg',
    });
    return request('/providers/me/photo', { method: 'POST', body: form });
}