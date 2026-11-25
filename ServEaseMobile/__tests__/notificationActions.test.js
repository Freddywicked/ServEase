import { request } from '../api/client';
import {
  flushPendingNotification,
  markNotificationRead,
  normalizeRemoteMessage,
  openNotification,
} from '../utils/notificationActions';
import { useNotificationBannerStore } from '../utils/notificationBannerStore';

jest.mock('../api/client', () => ({ request: jest.fn() }));

const navigationFor = (getRouteName) => ({
  isReady: jest.fn(() => true),
  getCurrentRoute: jest.fn(() => ({ name: getRouteName() })),
  navigate: jest.fn(),
});

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ ok: true });
  useNotificationBannerStore.setState({ current: null, receivedTick: 0 });
});

test('normalizes FCM data and prefers the public request reference', () => {
  expect(normalizeRemoteMessage({
    messageId: 'fcm-delivery-1',
    notification: { title: 'ServEase', body: 'New quotation' },
    data: {
      notificationId: 'notification-1',
      type: 'quotation_received',
      requestId: 'database-uuid',
      requestRef: 'SR-0007',
    },
  })).toMatchObject({
    id: 'notification-1',
    deliveryId: 'fcm-delivery-1',
    title: 'ServEase',
    message: 'New quotation',
    type: 'quotation_received',
    requestId: 'SR-0007',
  });
});

test('marks a notification read through the shared authenticated API helper', async () => {
  await markNotificationRead('notification / 1');

  expect(request).toHaveBeenCalledWith('/notifications/notification%20%2F%201/read', { method: 'POST' });
  expect(useNotificationBannerStore.getState().receivedTick).toBe(1);
});

test('opens a customer quotation with the request id expected by RequestDetails', () => {
  const navigation = navigationFor(() => 'CustomerDashboard');
  openNotification(navigation, {
    id: 'notification-2', type: 'quotation_received', requestId: 'SR-0008',
  });

  expect(navigation.navigate).toHaveBeenCalledWith('RequestDetails', { requestId: 'SR-0008' });
  expect(request).toHaveBeenCalledWith('/notifications/notification-2/read', { method: 'POST' });
});

test('opens provider and customer chats with conversationId', () => {
  const providerNavigation = navigationFor(() => 'Jobs');
  openNotification(providerNavigation, {
    type: 'new_message', requestId: 'SR-0009',
  });
  expect(providerNavigation.navigate).toHaveBeenCalledWith('ConversationServiceProvider', {
    conversationId: 'SR-0009',
  });

  const customerNavigation = navigationFor(() => 'Track');
  openNotification(customerNavigation, {
    type: 'new_message', requestId: 'SR-0010',
  });
  expect(customerNavigation.navigate).toHaveBeenCalledWith('ConversationCustomer', {
    conversationId: 'SR-0010',
  });
});

test('holds a cold-start notification until authentication reaches a dashboard', () => {
  let routeName = 'LoginScreen';
  const navigation = navigationFor(() => routeName);
  const notification = { id: 'notification-3', type: 'new_request', requestId: 'SR-0011' };

  openNotification(navigation, notification);
  flushPendingNotification(navigation);
  expect(navigation.navigate).not.toHaveBeenCalled();

  routeName = 'ServiceProviderDashboard';
  flushPendingNotification(navigation);
  expect(navigation.navigate).toHaveBeenCalledWith('ViewServiceRequest', { requestId: 'SR-0011' });
});

test('routes payment requests to the customer quotation section', () => {
  const navigation = navigationFor(() => 'CustomerDashboard');
  openNotification(navigation, { type: 'payment_request', requestId: 'SR-0012' });

  expect(navigation.navigate).toHaveBeenCalledWith('Track', {
    tab: 'ongoing', section: 'quotations',
  });
});
