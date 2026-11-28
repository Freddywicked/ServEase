import { request } from '../api/client';
import {
  MAX_UPDATE_ATTACHMENTS,
  acceptNegotiation,
  getProviderJobQuotations,
  rejectNegotiation,
  updateJobStatus,
} from '../api/providerWork_api';

jest.mock('../api/client', () => ({ request: jest.fn() }));

const OriginalFormData = global.FormData;
let formParts;

beforeAll(() => {
  global.FormData = class MockFormData {
    append(name, value) {
      formParts.push({ name, value });
    }
  };
});

afterAll(() => {
  global.FormData = OriginalFormData;
});

describe('provider job status updates', () => {
  beforeEach(() => {
    formParts = [];
    request.mockReset();
    request.mockResolvedValue({ ok: true });
  });

  test('submits one image and one video using the shared attachments field', async () => {
    await updateJobStatus('SR-0104', {
      stage: 'Repairing',
      notes: 'Work in progress',
      media: [
        { uri: 'file://photo.jpg', type: 'image/jpeg', fileName: 'photo.jpg', isVideo: false },
        { uri: 'file://video.mp4', type: 'video/mp4', fileName: 'video.mp4', isVideo: true },
      ],
    });

    const [path, options] = request.mock.calls[0];
    expect(path).toBe('/provider/jobs/SR-0104/status');
    expect(options.method).toBe('PATCH');
    expect(formParts.map((part) => part.name)).toEqual(['stage', 'notes', 'attachments', 'attachments']);
    expect(formParts.slice(2).map((part) => part.value.name)).toEqual(['photo.jpg', 'video.mp4']);
  });

  test('allows a status update without attachments', async () => {
    await updateJobStatus('SR-0104', { stage: 'Assessing', notes: '', media: [] });

    expect(request).toHaveBeenCalledWith('/provider/jobs/SR-0104/status', {
      method: 'PATCH',
      body: { stage: 'Assessing', notes: '' },
    });
  });

  test('rejects only attachments beyond the shared total limit', async () => {
    const media = Array.from({ length: MAX_UPDATE_ATTACHMENTS + 1 }, (_, index) => ({
      uri: `file://video-${index}.mp4`,
      type: 'video/mp4',
      isVideo: true,
    }));

    expect(() => updateJobStatus('SR-0104', { stage: 'Repairing', notes: '', media })).toThrow(
      'You can attach up to 5 photos or videos per update.'
    );
    expect(request).not.toHaveBeenCalled();
  });
});

describe('provider price negotiations', () => {
  beforeEach(() => {
    request.mockReset();
    request.mockResolvedValue({ ok: true });
  });

  test('loads unsettled additional payments and negotiations for mobile Jobs', async () => {
    await getProviderJobQuotations();

    expect(request).toHaveBeenCalledWith('/provider/jobs/quotations?includePaymentRequests=true');
  });

  test('accepts a negotiation using both its job and payment-request ids', async () => {
    await acceptNegotiation('SR-0104', 'payment-request-1');

    expect(request).toHaveBeenCalledWith(
      '/provider/jobs/SR-0104/payment-requests/payment-request-1/negotiation/accept',
      { method: 'POST' }
    );
  });

  test('declines a negotiation with the reason on the shared endpoint', async () => {
    await rejectNegotiation('SR-0104', 'payment-request-1', 'The suggested amount is too low.');

    expect(request).toHaveBeenCalledWith(
      '/provider/jobs/SR-0104/payment-requests/payment-request-1/negotiation/reject',
      {
        method: 'POST',
        body: { reason: 'The suggested amount is too low.' },
      }
    );
  });
});

