import { AppState, PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { registerDeviceToken } from '../api/client';
import { setupPushNotifications } from '../utils/pushNotifications';
import { useNotificationBannerStore } from '../utils/notificationBannerStore';

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../api/client', () => ({
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
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(33);
    useNotificationBannerStore.setState({ current: null, receivedTick: 0 });

    appStateRemove = jest.fn();
    unsubscribeMessages = jest.fn();
    unsubscribeRefresh = jest.fn();
    messagingInstance = {
      getToken: jest.fn().mockResolvedValue('test-fcm-token'),
      onTokenRefresh: jest.fn(() => unsubscribeRefresh),
      onMessage: jest.fn((handler) => {
        messageHandler = handler;
        return unsubscribeMessages;
      }),
    };
    messaging.mockReturnValue(messagingInstance);
    registerDeviceToken.mockResolvedValue({ ok: true });
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
});
