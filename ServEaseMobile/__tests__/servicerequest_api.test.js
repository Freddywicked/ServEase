import { browseServiceProviders } from '../api/servicerequest_api';

jest.mock('../api/client', () => ({
  API_BASE_URL: 'http://test.local/api',
  getToken: jest.fn(async () => 'test-token'),
}));

describe('service provider browsing', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ providers: [] }),
    }));
  });

  test('sends the device-local calendar date and slot to the backend', async () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const expectedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const expectedSlot = `${pad(now.getHours())}:00`;

    await browseServiceProviders({ available: true });

    const url = new URL(global.fetch.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/service-providers');
    expect(url.searchParams.get('available')).toBe('true');
    expect(url.searchParams.get('date')).toBe(expectedDate);
    expect(url.searchParams.get('slot')).toBe(expectedSlot);
  });
});
