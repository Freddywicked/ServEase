import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { getToken, me, logout, setOnUnauthorized } from '../api/client';
import { AuthProvider, useAuth } from '../context/auth_context';
import { setupPushNotifications, teardownPushNotifications } from '../utils/pushNotifications';
import { signOutGoogle } from '../utils/googleSignIn';

jest.mock('../api/client', () => ({
  getToken: jest.fn(),
  me: jest.fn(),
  logout: jest.fn(),
  setOnUnauthorized: jest.fn(),
}));

jest.mock('../utils/pushNotifications', () => ({
  setupPushNotifications: jest.fn(),
  teardownPushNotifications: jest.fn(),
}));

jest.mock('../utils/googleSignIn', () => ({
  signOutGoogle: jest.fn(),
}));

let auth;
const CaptureAuth = () => {
  auth = useAuth();
  return null;
};

describe('authentication push lifecycle', () => {
  let renderer;

  const renderProvider = async () => {
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <CaptureAuth />
        </AuthProvider>
      );
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getToken.mockResolvedValue(null);
    logout.mockResolvedValue(undefined);
    setupPushNotifications.mockResolvedValue(undefined);
    teardownPushNotifications.mockResolvedValue(undefined);
    signOutGoogle.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (renderer) ReactTestRenderer.act(() => renderer.unmount());
    renderer = null;
  });

  test('a cold start without a login revokes any stale native push token', async () => {
    await renderProvider();

    expect(teardownPushNotifications).toHaveBeenCalledTimes(1);
    expect(setupPushNotifications).not.toHaveBeenCalled();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.restoring).toBe(false);
  });

  test('a failed saved-session restore also revokes push delivery', async () => {
    getToken.mockResolvedValue('expired-jwt');
    me.mockRejectedValue(Object.assign(new Error('Expired'), { status: 401 }));

    await renderProvider();

    expect(teardownPushNotifications).toHaveBeenCalledTimes(1);
    expect(auth.isAuthenticated).toBe(false);
  });

  test('a 401 logout tears down native pushes as well as React auth state', async () => {
    getToken.mockResolvedValue('saved-jwt');
    me.mockResolvedValue({ user: { user_id: 'user-1' }, provider: null });
    await renderProvider();
    const onUnauthorized = setOnUnauthorized.mock.calls[0][0];

    await ReactTestRenderer.act(async () => onUnauthorized());

    expect(teardownPushNotifications).toHaveBeenCalledTimes(1);
    expect(auth.isAuthenticated).toBe(false);
  });

  test('explicit sign out unregisters pushes before clearing the JWT', async () => {
    getToken.mockResolvedValue('saved-jwt');
    me.mockResolvedValue({ user: { user_id: 'user-1' }, provider: null });
    await renderProvider();

    await ReactTestRenderer.act(async () => auth.signOut());

    expect(teardownPushNotifications).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(teardownPushNotifications.mock.invocationCallOrder[0]).toBeLessThan(
      logout.mock.invocationCallOrder[0]
    );
    expect(auth.isAuthenticated).toBe(false);
  });
});
