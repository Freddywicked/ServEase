import { browseServiceProviders, normalizeRepairDetails, respondToQuotation } from '../api/servicerequest_api';

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

describe('repair-details compatibility', () => {
  test('maps the shared backend DTO to the fields used by the mobile timeline', () => {
    const result = normalizeRepairDetails({
      requestNumber: 'SR-0104',
      steps: [
        {
          key: 'Repairing',
          label: 'Repairing',
          done: true,
          updatedAt: '2026-11-24T12:00:00.000Z',
          updates: [
            {
              id: 'update-1',
              updatedAt: '2026-11-24T12:00:00.000Z',
              notes: 'One photo and one video attached',
              attachments: [
                { id: 'photo-1', type: 'image', url: 'https://example.test/photo.jpg' },
                { id: 'video-1', type: 'video', url: 'https://example.test/video.mp4' },
              ],
            },
          ],
        },
      ],
    });

    expect(result.steps[0].timestamp).toBe('2026-11-24T12:00:00.000Z');
    expect(result.steps[0].updates[0]).toMatchObject({
      note: 'One photo and one video attached',
      createdAt: '2026-11-24T12:00:00.000Z',
    });
    expect(result.steps[0].updates[0].media).toHaveLength(2);
    expect(result.steps[0].updates[0].media.map((item) => item.type)).toEqual(['image', 'video']);
  });

  test('keeps older mobile-shaped responses working', () => {
    const update = { id: 'legacy', note: 'Legacy note', createdAt: '2026-01-01', media: [] };
    const result = normalizeRepairDetails({ steps: [{ timestamp: '2026-01-01', updates: [update] }] });

    expect(result.steps[0].timestamp).toBe('2026-01-01');
    expect(result.steps[0].updates[0]).toMatchObject(update);
  });
});

describe('quotation responses', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, approved: false }),
    }));
  });

  test('sends the trimmed quotation rejection reason to the backend', async () => {
    await respondToQuotation('SR-0104', { approve: false, reason: '  The price is beyond my budget.  ' });

    const [url, options] = global.fetch.mock.calls[0];
    expect(new URL(url).pathname).toBe('/api/service-requests/SR-0104/quotation/respond');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      approve: false,
      reason: 'The price is beyond my budget.',
    });
  });
});
