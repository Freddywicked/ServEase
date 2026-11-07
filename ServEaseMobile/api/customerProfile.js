// api/customerProfile.js
// Backend calls for the customer's own profile. Built on client.js's shared
// request() so it gets the same base URL, auth token, timeout, 401 handling and
// error shape (err.message, err.status, err.fieldErrors) as every other API.
import { request, me } from './client';

// GET /auth/me (already in client.js) -> { user: { name, email, phone_number, address, photoUrl, ... } }
export const fetchMyProfile = async () => {
    const data = await me();
    return data?.user || data;
};

// PATCH /users/me  { email, address }
// BACKEND: PATCH /api/users/me must accept email + address (same route that already
// takes { activeMode }) and return the updated user.
export const updateMyProfile = async (fields) => {
    const data = await request('/users/me', { method: 'PATCH', body: fields });
    return data?.user || data;
};

// POST /users/me/photo  (multipart, field "photo") -> { photoUrl }
// BACKEND: new route; store the file (e.g. Supabase Storage) and save the URL on the user.
export const uploadMyPhoto = (uri, fileName, mimeType) => {
    const form = new FormData();
    form.append('photo', {
        uri,
        name: fileName || 'profile.jpg',
        type: mimeType || 'image/jpeg',
    });
    return request('/users/me/photo', { method: 'POST', body: form });
};