const test = require('node:test');
const assert = require('node:assert/strict');

// Exercise the real mobile recommendation controller without a database or network.
const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

let providers;
let unavailableRows;

const Request = {
  listVerifiedProviders: async () => providers,
  findUsersByIds: async (ids) =>
    Object.fromEntries(ids.map((id) => [id, { name: `Provider ${id}`, address: '' }])),
  listRatingsForProviders: async () => ({}),
  listActiveEngagementsOnDate: async () => [],
};
const Workflow = {
  listUnavailableSlotsFor: async () => unavailableRows,
};

mockModule('../src/models/servicerequest_model', Request);
mockModule('../src/models/provider_model', {});
mockModule('../src/models/workflow_model', Workflow);
mockModule('../src/config', { googleMaps: { apiKey: '' } });
mockModule('../src/utils/storage', { getProviderFileUrl: async () => null });
mockModule('../src/utils/ai_diagnosis', { diagnose: async () => null });

const { recommendedForDraft } = require('../src/controllers/servicerequest_controllers');

const provider = (id, specialization, offersHomeService = true) => ({
  user_id: id,
  specializations: [specialization],
  company_name: `Company ${id}`,
  company_address: '',
  years_of_experience: 5,
  availability: null,
  offers_home_service: offersHomeService,
  home_service_radius_km: offersHomeService ? 20 : null,
  profile_photo: null,
});

const invokeRecommendations = async (serviceLocationType) => {
  const res = {
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let forwardedError;
  await recommendedForDraft(
    {
      user: { user_id: 'customer-1' },
      query: {
        category: 'it-related-devices',
        preferredDate: '2026-12-01',
        preferredTime: '10:00',
        serviceLocationType,
        radiusKm: '100',
      },
    },
    res,
    (error) => {
      forwardedError = error;
    }
  );
  if (forwardedError) throw forwardedError;
  return res.body.providers;
};

test.beforeEach(() => {
  unavailableRows = [];
  providers = [
    provider('it-home', 'IT-Related Device Repair'),
    provider('it-shop', 'IT-Related Device Repair', false),
    provider('phone-home', 'Phone Repair'),
  ];
});

test('does not substitute another category when every matching provider is unavailable', async () => {
  providers = [
    provider('it-unavailable', 'IT-Related Device Repair'),
    provider('phone-available', 'Phone Repair'),
  ];
  unavailableRows = Array.from({ length: 8 }, (_, index) => ({
    provider_id: 'it-unavailable',
    slot: `${String(9 + index).padStart(2, '0')}:00`,
  }));

  const result = await invokeRecommendations('shop');

  assert.deepEqual(result, []);
});

test('home-based recommendations require the same category and home service', async () => {
  const result = await invokeRecommendations('home');

  assert.deepEqual(result.map((p) => p.id), ['it-home']);
});

test('shop-based recommendations allow home and shop-only providers in the same category', async () => {
  const result = await invokeRecommendations('shop');

  assert.deepEqual(new Set(result.map((p) => p.id)), new Set(['it-home', 'it-shop']));
  assert.equal(result.some((p) => p.id === 'phone-home'), false);
});
