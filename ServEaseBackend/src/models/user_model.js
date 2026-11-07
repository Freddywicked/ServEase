const { supabase } = require('../config/supabase');
const { unwrap } = require('../utils/db');
const { getUserPhotoUrl } = require('../utils/storage');

// The users table's primary key is user_id (see migrations/001_align_schema_with_erd.sql).
// Only select `password_hash` when you must check it (login). Never send it to the client.
// prefers_home_service / search_radius_km are the customer's saved defaults (migrations/radius_preferences.sql).
// photo_url is the private storage path of the profile photo (migrations/009) — never send
// it raw; use withPhotoUrl() to turn it into a signed, display-ready photoUrl first.
const PUBLIC_FIELDS =
  'user_id, name, username, email, phone_number, role, address, birthdate, gender, active_mode, prefers_home_service, search_radius_km, photo_url';

const findByEmail = async (email, columns = '*') =>
  unwrap(await supabase.from('users').select(columns).eq('email', email).maybeSingle());

const findByUsername = async (username, columns = '*') =>
  unwrap(await supabase.from('users').select(columns).eq('username', username).maybeSingle());

// google_id is the "sub" claim of a verified Google ID token (migrations/008).
const findByGoogleId = async (googleId, columns = '*') =>
  unwrap(await supabase.from('users').select(columns).eq('google_id', googleId).maybeSingle());

// Attach a Google account to an existing user (same verified email = same person).
const linkGoogleId = async (id, googleId) =>
  unwrap(await supabase.from('users').update({ google_id: googleId }).eq('user_id', id));

// Complete-profile flow: set the phone number after its OTP has been verified.
const setPhoneNumber = async (id, phoneE164) =>
  unwrap(
    await supabase.from('users').update({ phone_number: phoneE164 }).eq('user_id', id).select(PUBLIC_FIELDS).single()
  );

const findById = async (id) =>
  unwrap(await supabase.from('users').select(PUBLIC_FIELDS).eq('user_id', id).maybeSingle());

const findProvider = async (userId) =>
  unwrap(
    await supabase
      .from('service_providers')
      .select('user_id, verification_status')
      .eq('user_id', userId)
      .maybeSingle()
  );

// BR-02: every new account starts as a customer (users row + customers row).
const createCustomer = async (fields) => {
  const user = unwrap(
    await supabase.from('users').insert({ ...fields, role: 'customer' }).select(PUBLIC_FIELDS).single()
  );

  const { error } = await supabase.from('customers').insert({ user_id: user.user_id });
  if (error) {
    // supabase-js can't run a multi-table transaction, so undo the first insert by hand.
    await supabase.from('users').delete().eq('user_id', user.user_id);
    unwrap({ error });
  }
  return user;
};

// Which side of the app the account is using: 'customer' | 'service_provider'.
const setActiveMode = async (id, mode) =>
  unwrap(
    await supabase.from('users').update({ active_mode: mode }).eq('user_id', id).select(PUBLIC_FIELDS).single()
  );

// Customer defaults: "Home Service" preference and provider search radius (km).
// Pass only the fields being changed. The caller validates (radius 5-100, boolean preference);
// the CHECK constraint on users.search_radius_km is the last line of defence (db.js turns it into a 400).
const updatePreferences = async (id, { prefersHomeService, searchRadiusKm }) => {
  const changes = {};
  if (prefersHomeService !== undefined) changes.prefers_home_service = prefersHomeService;
  if (searchRadiusKm !== undefined) changes.search_radius_km = searchRadiusKm;
  return unwrap(
    await supabase.from('users').update(changes).eq('user_id', id).select(PUBLIC_FIELDS).single()
  );
};

// Customer Edit Profile: email + home address. Pass only the fields being changed.
// A duplicate email hits the unique index and db.js turns it into a 409
// ("Email is already registered").
const updateProfile = async (id, { email, address }) => {
  const changes = {};
  if (email !== undefined) changes.email = email;
  if (address !== undefined) changes.address = address;
  return unwrap(
    await supabase.from('users').update(changes).eq('user_id', id).select(PUBLIC_FIELDS).single()
  );
};

// Store the private storage path of the user's new profile photo.
const setPhoto = async (id, path) =>
  unwrap(
    await supabase.from('users').update({ photo_url: path }).eq('user_id', id).select(PUBLIC_FIELDS).single()
  );

const toPublic = ({ password, password_hash, ...rest }) => rest;

// Adds a display-ready `photoUrl` (signed, short-lived) and hides the raw storage path.
// The mobile app reads user.photoUrl (camelCase); the raw path is useless to clients.
const withPhotoUrl = async (user) => {
  if (!user) return user;
  const { photo_url, ...rest } = toPublic(user);
  return { ...rest, photoUrl: await getUserPhotoUrl(photo_url) };
};

module.exports = {
  findByEmail,
  findByUsername,
  findByGoogleId,
  linkGoogleId,
  setPhoneNumber,
  findById,
  findProvider,
  createCustomer,
  setActiveMode,
  updatePreferences,
  updateProfile,
  setPhoto,
  toPublic,
  withPhotoUrl,
};