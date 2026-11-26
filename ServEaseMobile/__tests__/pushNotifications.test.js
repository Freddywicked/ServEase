import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import { getMessaging } from '@react-native-firebase/messaging';
import { getToken, registerDeviceToken, unregisterDeviceToken } from '../api/client';
import { setupPushNotifications, teardownPushNotifications } from '../utils/pushNotifications';
import { useNotificationBannerStore } from '../utils/notificationBannerStore';

jest.mock('@react-native-firebase/messaging', () => ({
  // This is the actual export shape of @react-native-firebase/messaging v26.
  getMessaging: jest.fn(),
}));

jest.mock('../api/client', () => ({
  getToken: jest.fn(),
  registerDeviceToken: jest.fn(),
  unregisterDeviceToken: jest.fn(),
}));

jest.mock('../utils/providerTabBadges', () => ({
  refreshProviderBadgeCounts: jest.fn(),
}));

describe('push notification setup', () => {
  let appStateHandler;
  let messageHandler;
  let cleanup;
  let appStateRemove;
  let unsubscribeMessages;
  let unsubscribeRefresh;
  let messagingInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    // Exercise release behavior, where setup diagnostics are user-visible.
    jest.replaceProperty(global, '__DEV__', false);
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
    useNotificationBannerStore.setState({ current: null, receivedTick: 0 });

    appStateRemove = jest.fn();
    unsubscribeMessages = jest.fn();
    unsubscribeRefresh = jest.fn();
    messagingInstance = {
      getToken: jest.fn().mockResolvedValue('test-fcm-token'),
      deleteToken: jest.fn().mockResolvedValue(undefined),
      onTokenRefresh: jest.fn(() => unsubscribeRefresh),
      onMessage: jest.fn((handler) => {
        messageHandler = handler;
        return unsubscribeMessages;
      }),
    };
    getMessaging.mockReturnValue(messagingInstance);
    getToken.mockResolvedValue('test-auth-token');
    registerDeviceToken.mockResolvedValue({ ok: true });
    unregisterDeviceToken.mockResolvedValue({ ok: true });
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(
      PermissionsAndroid.RESULTS.GRANTED
    );
    jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
      expect(event).toBe('change');
      appStateHandler = handler;
      return { remove: appStateRemove };
    });
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    jest.restoreAllMocks();
  });

  test('denied system permission does not block token registration or foreground banners', async () => {
    PermissionsAndroid.request.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    cleanup = await setupPushNotifications();

    expect(registerDeviceToken).toHaveBeenCalledWith('test-fcm-token', 'android');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(messagingInstance.onMessage).toHaveBeenCalledTimes(1);
    expect(cleanup).toEqual(expect.any(Function));

    messageHandler({
      messageId: 'delivery-after-denied-permission',
      notification: { title: 'ServEase', body: 'Foreground notification' },
      data: { notificationId: 'notification-1', type: 'general' },
    });

    expect(useNotificationBannerStore.getState().current).toMatchObject({
      id: 'notification-1',
      deliveryId: 'delivery-after-denied-permission',
      message: 'Foreground notification',
    });
  });

  test('registration failure keeps the listener and retries when the app becomes active', async () => {
    registerDeviceToken
      .mockRejectedValueOnce(new Error('backend offline'))
      .mockResolvedValueOnce({ ok: true });

    cleanup = await setupPushNotifications();

    expect(messagingInstance.onMessage).toHaveBeenCalledTimes(1);
    expect(registerDeviceToken).toHaveBeenCalledTimes(1);

    await appStateHandler('active');

    expect(registerDeviceToken).toHaveBeenCalledTimes(2);
    expect(registerDeviceToken).toHaveBeenLastCalledWith('test-fcm-token', 'android');

    cleanup();
    cleanup = undefined;
    expect(appStateRemove).toHaveBeenCalledTimes(1);
    expect(unsubscribeRefresh).toHaveBeenCalledTimes(1);
    expect(unsubscribeMessages).toHaveBeenCalledTimes(1);
  });

  test('logout revokes system-push delivery and blocks late foreground banners', async () => {
    cleanup = await setupPushNotifications();
    useNotificationBannerStore.getState().showNotification({
      deliveryId: 'before-logout',
      title: 'ServEase',
      message: 'Visible before logout',
    });

    await teardownPushNotifications();

    expect(unregisterDeviceToken).toHaveBeenCalledWith('test-fcm-token');
    expect(messagingInstance.deleteToken).toHaveBeenCalledTimes(1);
    expect(useNotificationBannerStore.getState().current).toBeNull();

    messageHandler({
      messageId: 'after-logout',
      notification: { title: 'ServEase', body: 'Must not appear' },
      data: {},
    });
    expect(useNotificationBannerStore.getState().current).toBeNull();
  });

  test('logged-out cleanup without a JWT never calls the protected unregister endpoint', async () => {
    getToken.mockResolvedValue(null);

    await teardownPushNotifications();

    expect(unregisterDeviceToken).not.toHaveBeenCalled();
    expect(messagingInstance.deleteToken).toHaveBeenCalledTimes(1);
  });

  test('logout waits for an in-flight registration before removing the token', async () => {
    let finishRegistration;
    registerDeviceToken.mockImplementation(() => new Promise((resolve) => {
      finishRegistration = resolve;
    }));

    const setupPromise = setupPushNotifications();
    await new Promise(setImmediate);
    expect(registerDeviceToken).toHaveBeenCalledWith('test-fcm-token', 'android');

    const teardownPromise = teardownPushNotifications();
    expect(unregisterDeviceToken).not.toHaveBeenCalled();

    finishRegistration({ ok: true });
    cleanup = await setupPromise;
    await teardownPromise;

    expect(unregisterDeviceToken).toHaveBeenCalledWith('test-fcm-token');
    expect(messagingInstance.deleteToken).toHaveBeenCalledTimes(1);
    expect(unregisterDeviceToken.mock.invocationCallOrder[0]).toBeGreaterThan(
      registerDeviceToken.mock.invocationCallOrder[0]
    );
  });
});
