const test = require('node:test');
const assert = require('node:assert/strict');

const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

const rows = [
  { request_id: 'request-1', file_url: 'customer/photo.jpg', filename: 'photo.jpg', media_type: 'image' },
  { request_id: 'request-1', file_url: 'customer/video.mp4', filename: 'video.mp4', media_type: 'video' },
];
let inserted;

mockModule('../src/config/supabase', {
  supabase: {
    from: (table) => {
      assert.equal(table, 'service_request_attachments');
      return {
        select: () => ({
          in: async () => ({ data: rows, error: null }),
        }),
        insert: (row) => {
          inserted = row;
          return {
            select: () => ({
              single: async () => ({ data: row, error: null }),
            }),
          };
        },
      };
    },
  },
});
mockModule('../src/utils/storage', {
  uploadServiceRequestPhoto: async () => null,
  getServiceRequestPhotoUrl: async (path) => `signed:${path}`,
});

const { addAttachment, attachmentsFor, photoUrlsFor } = require('../src/models/servicerequest_model');

test('attachment DTOs retain the stored image/video type and signed URL', async () => {
  const result = await attachmentsFor(['request-1']);
  assert.deepEqual(result, {
    'request-1': [
      { url: 'signed:customer/photo.jpg', type: 'image', filename: 'photo.jpg' },
      { url: 'signed:customer/video.mp4', type: 'video', filename: 'video.mp4' },
    ],
  });
});

test('legacy photo URL responses exclude videos', async () => {
  const result = await photoUrlsFor(['request-1']);
  assert.deepEqual(result, {
    'request-1': ['signed:customer/photo.jpg'],
  });
});

test('new attachments persist their media type and legacy inserts default to image', async () => {
  await addAttachment({ request_id: 'request-1', file_url: 'customer/video.mp4', filename: 'video.mp4', media_type: 'video' });
  assert.equal(inserted.media_type, 'video');

  await addAttachment({ request_id: 'request-1', file_url: 'customer/photo.jpg', filename: 'photo.jpg' });
  assert.equal(inserted.media_type, 'image');
});
