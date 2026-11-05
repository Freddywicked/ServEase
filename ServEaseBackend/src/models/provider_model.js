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
      .select('user_id, years_of_experience, profile_photo, verification_status, availability, company_name, company_address, home_service_radius_km')
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
    // How far (km) the provider travels for home service (5-100); null when not set.
    home_service_radius_km: row.home_service_radius_km ?? null,
    specializations: (specs || []).map((s) => s.specialization_name),
  };
};

// Everything the provider Profile screen needs beyond findProfile: the provider's own row,
// the service categories they offer, and their customer ratings (all of them, so the
// average and the positive-feedback share are exact) plus who wrote the latest reviews.
// Deliberately leaves out government_id and certification (private documents).
const PROFILE_REVIEW_LIMIT = 10;

const findProfilePageData = async (userId) => {
  const row = unwrap(
    await supabase
      .from('service_providers')
      .select('years_of_experience, profile_photo, availability, company_name, company_address')
      .eq('user_id', userId)
      .maybeSingle()
  );
  if (!row) return null;

  const specs = unwrap(
    await supabase
      .from('service_provider_specialization')
      .select('service_category')
      .eq('provider_id', userId)
  );

  const ratings =
    unwrap(
      await supabase
        .from('ratings')
        .select('rating_id, request_id, customer_id, rating, review, sentiment, created_at')
        .eq('provider_id', userId)
        .order('created_at', { ascending: false })
    ) || [];

  // Names and service categories are only needed for the reviews that are shown.
  const latest = ratings.slice(0, PROFILE_REVIEW_LIMIT);
  const customerIds = [...new Set(latest.map((r) => r.customer_id))];
  const requestIds = [...new Set(latest.map((r) => r.request_id))];

  const customers = customerIds.length
    ? unwrap(await supabase.from('users').select('user_id, name').in('user_id', customerIds))
    : [];
  const requests = requestIds.length
    ? unwrap(
        await supabase.from('service_requests').select('request_id, category').in('request_id', requestIds)
      )
    : [];

  return {
    row,
    categories: [...new Set((specs || []).map((s) => s.service_category).filter(Boolean))],
    ratings,
    latest,
    customers: customers || [],
    requests: requests || [],
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
  home_service_radius_km,
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
        // Only meaningful when the provider offers home service.
        home_service_radius_km: offers_home_service ? home_service_radius_km ?? null : null,
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

// Provider changes how far they travel for home service (already validated 5-100 by the caller).
const updateHomeServiceRadius = async (userId, km) =>
  unwrap(
    await supabase
      .from('service_providers')
      .update({ home_service_radius_km: km })
      .eq('user_id', userId)
      .select('user_id, home_service_radius_km')
      .single()
  );

module.exports = { findByUserId, findProfile, findProfilePageData, create, updateHomeServiceRadius };