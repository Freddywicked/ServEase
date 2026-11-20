const test = require('node:test');
const assert = require('node:assert/strict');

// Exercise the real controllers with isolated model/storage fakes. No database or network needed.
const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

const providerProfile = {
  years_of_experience: 6,
  profile_photo: null,
  availability: 'Mon, Tue, Wed, Thu, Fri · 9:00 AM - 5:00 PM',
  company_name: 'ServEase Repair',
  company_address: 'Naga City',
  specializations: ['Home Repair Services'],
};

const verifiedProvider = {
  user_id: 'provider-1',
  specializations: ['Home Repair Services'],
  company_name: 'ServEase Repair',
  company_address: 'Naga City',
  years_of_experience: 6,
  availability: null,
  offers_home_service: false,
  home_service_radius_km: null,
  profile_photo: null,
};

let reviews;
let unavailableRows;
let requestedAvailabilityDate;

const Request = {
  listReviewsForProvider: async () => reviews,
  listVerifiedProviders: async () => [verifiedProvider],
  findUsersByIds: async () => ({ 'provider-1': { name: 'Provider One', address: 'Naga City' } }),
  listRatingsForProviders: async () => ({}),
};
const Provider = {
  findProfile: async () => providerProfile,
};
const Workflow = {
  listUnavailableSlotsFor: async (providerIds, date) => {
    requestedAvailabilityDate = date;
    return unavailableRows;
  },
};

mockModule('../src/models/servicerequest_model', Request);
mockModule('../src/models/provider_model', Provider);
mockModule('../src/models/workflow_model', Workflow);
mockModule('../src/models/user_model', {});
mockModule('../src/config/supabase', { supabase: {} });
mockModule('../src/utils/storage', {
  uploadProviderFile: async () => null,
  getProviderFileUrl: async () => null,
  getUserPhotoUrl: async () => null,
});
mockModule('../src/utils/ai_sentiment', { analyzeSentiment: async () => 'neutral' });

const providerController = require('../src/controllers/provider_controllers');
const workflowController = require('../src/controllers/workflow_controllers');

const invoke = async (handler, req) => {
  const res = {
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let forwardedError;
  await handler(req, res, (error) => {
    forwardedError = error;
  });
  if (forwardedError) throw forwardedError;
  return res;
};

test.beforeEach(() => {
  reviews = [];
  unavailableRows = [];
  requestedAvailabilityDate = null;
});

test('Find marks a provider unavailable using the customer device calendar date', async () => {
  unavailableRows = Array.from({ length: 8 }, (_, index) => ({
    provider_id: 'provider-1',
    slot: `${String(9 + index).padStart(2, '0')}:00`,
  }));

  const res = await invoke(workflowController.browseProviders, {
    user: { user_id: 'customer-1' },
    query: { date: '2026-11-21', slot: '10:00' },
  });

  assert.equal(requestedAvailabilityDate, '2026-11-21');
  assert.equal(res.body.providers.length, 1);
  assert.equal(res.body.providers[0].available, false);
});

test('Find Available filter excludes a provider blocked for the whole requested day', async () => {
  unavailableRows = Array.from({ length: 8 }, (_, index) => ({
    provider_id: 'provider-1',
    slot: `${String(9 + index).padStart(2, '0')}:00`,
  }));

  const res = await invoke(workflowController.browseProviders, {
    user: { user_id: 'customer-1' },
    query: { available: 'true', date: '2026-11-21', slot: '10:00' },
  });

  assert.deepEqual(res.body.providers, []);
});

test('provider own profile returns rating statistics and masked customer reviews', async () => {
  reviews = [
    {
      id: 'rating-1',
      reviewerName: 'Marco Otea',
      rating: 5,
      serviceAvailed: 'Home Repair Services',
      comment: 'Excellent and professional work.',
    },
    {
      id: 'rating-2',
      reviewerName: 'Ana Cruz',
      rating: 3,
      serviceAvailed: 'Appliance Repair',
      comment: 'The repair was completed.',
    },
  ];

  const res = await invoke(providerController.getMyProfile, {
    user: {
      user_id: 'provider-1',
      name: 'Provider One',
      email: 'provider@example.com',
      address: 'Naga City',
    },
  });

  assert.equal(res.body.rating, 4);
  assert.equal(res.body.reviewCount, 2);
  assert.equal(res.body.aiSummary.positiveFeedbackPercent, 50);
  assert.deepEqual(res.body.reviews, [
    {
      id: 'rating-1',
      reviewer: 'M**co O***',
      rating: 5,
      service: 'Home Repair Services',
      comment: 'Excellent and professional work.',
    },
    {
      id: 'rating-2',
      reviewer: 'A** C***',
      rating: 3,
      service: 'Appliance Repair',
      comment: 'The repair was completed.',
    },
  ]);
});

test('provider own profile keeps empty-state values when there are no reviews', async () => {
  const res = await invoke(providerController.getMyProfile, {
    user: { user_id: 'provider-1', name: 'Provider One' },
  });

  assert.equal(res.body.rating, null);
  assert.equal(res.body.reviewCount, 0);
  assert.equal(res.body.aiSummary.positiveFeedbackPercent, null);
  assert.deepEqual(res.body.reviews, []);
});
