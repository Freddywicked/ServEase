import { useNotificationBannerStore } from '../utils/notificationBannerStore';

const resetStore = () => {
  useNotificationBannerStore.setState({ current: null, receivedTick: 0 });
};

describe('notification banner store', () => {
  beforeEach(resetStore);

  test('shows a normalized notification and notifies refresh listeners', () => {
    useNotificationBannerStore.getState().showNotification({
      id: 42,
      title: 'ServEase',
      message: 'New request',
      type: 'new_request',
    });

    const state = useNotificationBannerStore.getState();
    expect(state.current).toMatchObject({ id: '42', title: 'ServEase', type: 'new_request' });
    expect(state.current.key).toEqual(expect.any(Number));
    expect(state.current.createdAt).toEqual(expect.any(Number));
    expect(state.receivedTick).toBe(1);
  });

  test('shows every delivery when the same backend notification is sent twice', () => {
    const notification = { id: 'repeated-test-id', title: 'ServEase', message: 'First delivery' };
    const store = useNotificationBannerStore.getState();
    store.showNotification({ ...notification, deliveryId: 'fcm-delivery-1' });
    const first = useNotificationBannerStore.getState().current;

    store.showNotification({
      ...notification,
      deliveryId: 'fcm-delivery-2',
      message: 'Second delivery',
    });

    const state = useNotificationBannerStore.getState();
    expect(state.current).not.toBe(first);
    expect(state.current).toMatchObject({
      id: 'repeated-test-id',
      deliveryId: 'fcm-delivery-2',
      message: 'Second delivery',
    });
    expect(state.current.key).not.toBe(first.key);
    expect(state.receivedTick).toBe(2);
  });

  test('deduplicates repeated callbacks for one FCM delivery', () => {
    const notification = {
      id: 'duplicate-test-id',
      deliveryId: 'duplicate-fcm-delivery',
      title: 'ServEase',
      message: 'Once',
    };
    useNotificationBannerStore.getState().showNotification(notification);
    const first = useNotificationBannerStore.getState().current;

    useNotificationBannerStore.getState().showNotification({ ...notification, message: 'Twice' });

    const state = useNotificationBannerStore.getState();
    expect(state.current).toBe(first);
    expect(state.current.message).toBe('Once');
    expect(state.receivedTick).toBe(1);
  });

  test('a late dismissal cannot remove a newer notification', () => {
    const store = useNotificationBannerStore.getState();
    store.showNotification({ id: 'old-banner-test-id', message: 'Old' });
    const oldKey = useNotificationBannerStore.getState().current.key;
    store.showNotification({ id: 'new-banner-test-id', message: 'New' });
    const current = useNotificationBannerStore.getState().current;

    store.dismissNotification(oldKey);
    expect(useNotificationBannerStore.getState().current).toBe(current);

    store.dismissNotification(current.key);
    expect(useNotificationBannerStore.getState().current).toBeNull();
  });

  test('refreshNotifications increments the tick without creating a banner', () => {
    useNotificationBannerStore.getState().refreshNotifications();
    expect(useNotificationBannerStore.getState().receivedTick).toBe(1);
    expect(useNotificationBannerStore.getState().current).toBeNull();
  });
});
