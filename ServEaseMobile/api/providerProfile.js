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

import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Adapter: the only part that depends on how api/client.js is set up.
// Point these two at the same base URL and token storage that api/client.js uses
// (or replace authFetch with that file's own request helper).
// ---------------------------------------------------------------------------
const API_URL = 'https://YOUR-BACKEND.onrender.com';
const TOKEN_KEY = 'token';

async function authFetch(path) {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${API_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        // empty or non-JSON body
    }

    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
    }
    return data;
}

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
    return normalizeProfile(await authFetch('/api/providers/me/profile'));
}