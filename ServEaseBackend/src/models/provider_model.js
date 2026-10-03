const { supabase } = require('../config/supabase');
const { unwrap } = require('../utils/db');

const findByUserId = async (userId) =>
  unwrap(
    await supabase
      .from('service_providers')
      .select('user_id, verification_status')
      .eq('user_id', userId)
      .maybeSingle()
  );

// Everything the app needs to show a provider's own profile/dashboard.
// Deliberately leaves out government_id and certification (private documents).
const findProfile = async (userId) => {
  const row = unwrap(
    await supabase
      .from('service_providers')
      .select('user_id, experience, profile_photo, verification_status, offers_home_services')
      .eq('user_id', userId)
      .maybeSingle()
  );
  if (!row) return null;

  const specs = unwrap(
    await supabase
      .from('service_provider_specialization')
      .select('specialization_name')
      .eq('provider_id', userId)
  );

  return {
    verification_status: row.verification_status,
    years_of_experience: row.experience,
    profile_photo: row.profile_photo,
    offers_home_services: row.offers_home_services,
    specializations: (specs || []).map((s) => s.specialization_name),
  };
};

// Creates the service_providers row, then one service_provider_specialization
// row per selected category/service. verification_status always starts 'pending' —
// an admin flips it to 'verified' (or rejects it) from the web dashboard,
// not from here.
const create = async ({
  user_id,
  experience,
  government_id,
  profile_photo,
  certification,
  offers_home_services,
  specializations,
}) => {
  const provider = unwrap(
    await supabase
      .from('service_providers')
      .insert({
        user_id,
        experience,
        government_id,
        profile_photo,
        certification,
        offers_home_services,
        verification_status: 'pending',
      })
      .select('user_id, verification_status')
      .single()
  );

  if (specializations.length) {
    const rows = specializations.map((specialization_name) => ({ provider_id: user_id, specialization_name }));
    const { error } = await supabase.from('service_provider_specialization').insert(rows);
    if (error) {
      // supabase-js can't run a multi-table transaction, so undo the first insert by hand.
      await supabase.from('service_providers').delete().eq('user_id', user_id);
      throw error;
    }
  }

  return provider;
};

module.exports = { findByUserId, findProfile, create };