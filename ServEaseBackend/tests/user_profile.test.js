const test = require('node:test');
const assert = require('node:assert/strict');

// Exercise the real controller and model with a local Supabase fake. No environment
// variables, network requests, or live database writes are needed for this suite.
const mockModule = (request, exports) => {
  const filename = require.resolve(request);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
};

const INITIAL_USER = {
  user_id: 'user-1',
  name: 'Original Name',
  email: 'original@example.com',
  address: 'Original address',
  role: 'customer',
  photo_url: null,
};

let storedUser;
let lastUpdate;

const supabase = {
  from(table) {
    assert.equal(table, 'users');
    let changes;
    let userId;
    const builder = {
      update(value) {
        changes = value;
        return builder;
      },
      eq(column, value) {
        assert.equal(column, 'user_id');
        userId = value;
        return builder;
      },
      select() {
        return builder;
      },
      async single() {
        lastUpdate = { userId, changes };
        assert.equal(userId, storedUser.user_id);
        storedUser = { ...storedUser, ...changes };
        return { data: storedUser, error: null };
      },
    };
    return builder;
  },
};

mockModule('../src/config/supabase', { supabase });
mockModule('../src/utils/storage', {
  uploadUserPhoto: async () => null,
  getUserPhotoUrl: async () => null,
});

const users = require('../src/controllers/user_controllers');

const invoke = async (body) => {
  const req = { user: { ...storedUser }, body };
  const res = {
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let forwardedError;
  await users.updateMe(req, res, (error) => {
    forwardedError = error;
  });
  if (forwardedError) throw forwardedError;
  return res;
};

test.beforeEach(() => {
  storedUser = { ...INITIAL_USER };
  lastUpdate = null;
});

test('a name-only edit reaches the users table and returns the updated user', async () => {
  const res = await invoke({ name: '  Updated Customer  ' });

  assert.deepEqual(lastUpdate, {
    userId: 'user-1',
    changes: { name: 'Updated Customer' },
  });
  assert.equal(storedUser.name, 'Updated Customer');
  assert.equal(res.body.user.name, 'Updated Customer');
  assert.equal(res.body.user.email, INITIAL_USER.email);
  assert.equal(res.body.user.address, INITIAL_USER.address);
});

test('name, email, and address edits are normalized and persisted together', async () => {
  const res = await invoke({
    name: '  New Name  ',
    email: '  NEW.EMAIL@EXAMPLE.COM  ',
    address: '  New home address  ',
  });

  assert.deepEqual(lastUpdate.changes, {
    name: 'New Name',
    email: 'new.email@example.com',
    address: 'New home address',
  });
  assert.equal(res.body.user.name, 'New Name');
  assert.equal(res.body.user.email, 'new.email@example.com');
  assert.equal(res.body.user.address, 'New home address');
});

test('an empty name is rejected before any database update', async () => {
  await assert.rejects(invoke({ name: '   ' }), (error) => {
    assert.equal(error.status, 400);
    assert.deepEqual(error.details, { name: 'Name is required' });
    return true;
  });

  assert.equal(lastUpdate, null);
  assert.deepEqual(storedUser, INITIAL_USER);
});
