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
      .select('user_id, years_of_experience, profile_photo, verification_status, availability, company_name, company_address')
      .eq('user_id', userId)
      .maybeSingle()
  );
  if (!row) return null;

  // ERD: SERVICE_PROVIDER_SPECIALIZATION holds service_category,
  // specialization_name and offers_home_service (one row per category/service).
  const specs = unwrap(
    await supabase
      .from('service_provider_specialization')
      .select('specialization_name, service_category, offers_home_service')
      .eq('provider_id', userId)
  );

  return {
    verification_status: row.verification_status,
    years_of_experience: row.years_of_experience,
    profile_photo: row.profile_photo,
    // offers_home_service lives on the specialization rows now; the API key
    // keeps the old plural form so existing app builds keep working.
    offers_home_services: (specs || []).some((s) => s.offers_home_service),
    availability: row.availability,
    company_name: row.company_name,
    company_address: row.company_address,
    specializations: (specs || []).map((s) => s.specialization_name),
  };
};

// Creates the service_providers row, then one service_provider_specialization
// row per selected category/service. verification_status always starts 'pending' —
// an admin flips it to 'verified' (or rejects it) from the web dashboard.
//
// `specializations` is a deduped list of { service_category, specialization_name }
// built by provider_controllers.js. offers_home_service is stored on each
// specialization row (ERD SERVICE_PROVIDER_SPECIALIZATION).
const create = async ({
  user_id,
  company_name,
  company_address,
  years_of_experience,
  government_id,
  profile_photo,
  certification,
  offers_home_service,
  specializations,
}) => {
  const provider = unwrap(
    await supabase
      .from('service_providers')
      .insert({
        user_id,
        company_name,
        company_address,
        years_of_experience,
        government_id,
        profile_photo,
        certification,
        // availability is left null until the provider sets a schedule;
        // the column is text, not boolean.
        verification_status: 'pending',
      })
      .select('user_id, verification_status')
      .single()
  );

  if (specializations.length) {
    const rows = specializations.map((s) => ({
      provider_id: user_id,
      service_category: s.service_category,
      specialization_name: s.specialization_name,
      offers_home_service: Boolean(offers_home_service),
    }));
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
