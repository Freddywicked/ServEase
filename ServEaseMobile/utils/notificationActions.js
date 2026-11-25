// utils/notificationActions.js
import { request } from '../api/client';
import { useNotificationBannerStore } from './notificationBannerStore';

/* ------------------------------------------------------------------ */
/* Routing (screen names are from App.js)                              */
/* ------------------------------------------------------------------ */
// Screens before login; a notification tapped on cold start waits until the user is past these.
const AUTH_ROUTES = new Set([
  'SplashScreen', 'SignupScreen', 'SendOTP', 'OTPVerification', 'LoginScreen',
  'CompleteProfile', 'ForgotPassword', 'OTPForgotPassword', 'NewPassword',
]);

// Screens of the provider side; used to pick the right chat screen for `new_message`.
const PROVIDER_ROUTES = new Set([
  'ServiceProviderDashboard', 'IncomingServiceRequest', 'Jobs', 'JobUpdateStatus',
  'JobAdditionalParts', 'ViewServiceRequest', 'MessageServiceProvider',
  'ConversationServiceProvider', 'Earnings', 'ServiceProviderProfile',
  'ServiceProviderEditProfile',
]);

const buildRoute = (type, requestId, isProvider) => {
  switch (type) {
    case 'new_request':
      return requestId
        ? { name: 'ViewServiceRequest', params: { requestId } }
        : { name: 'IncomingServiceRequest' };
    case 'quotation_received':
      return requestId
        ? { name: 'RequestDetails', params: { requestId } }
        : { name: 'Track', params: { tab: 'approved' } };
    case 'new_message':
      return requestId
        ? {
            name: isProvider ? 'ConversationServiceProvider' : 'ConversationCustomer',
            params: { conversationId: requestId },
          }
        : { name: isProvider ? 'MessageServiceProvider' : 'MessageCustomer' };
    case 'payment_received':
      return { name: 'Earnings' };
    case 'rating_received':
      return { name: 'ServiceProviderDashboard' };
    case 'quotation_accepted':
    case 'schedule_accepted':
    case 'schedule_rejected':
    case 'payment_approved':
    case 'payment_rejected':
    case 'payment_negotiation':
      return { name: 'Jobs' };
    case 'quotation_declined':
      return { name: 'IncomingServiceRequest' };
    case 'request_accepted':
      return { name: 'Track', params: { tab: 'sent' } };
    case 'request_declined':
      return { name: 'Track', params: { tab: 'declined' } };
    case 'schedule_proposal':
      return { name: 'Track', params: { tab: 'approved' } };
    case 'payment_request':
    case 'negotiation_accepted':
    case 'negotiation_rejected':
      return { name: 'Track', params: { tab: 'ongoing', section: 'quotations' } };
    case 'progress_update':
      return { name: 'Track', params: { tab: 'ongoing', section: 'ongoing' } };
    case 'job_completed':
      return { name: 'Track', params: { tab: 'done' } };
    default:
      return null;
  }
};

/* ------------------------------------------------------------------ */
/* Normalizing + time label                                            */
/* ------------------------------------------------------------------ */
export function normalizeRemoteMessage(remoteMessage) {
  const data = remoteMessage?.data || {};
  const notification = remoteMessage?.notification || {};
  return {
    id: data.notificationId ? String(data.notificationId) : null,
    // FCM IDs identify deliveries, not database rows. The same notification may
    // legitimately be sent again, and each delivery must be allowed to display.
    deliveryId: remoteMessage?.messageId ? String(remoteMessage.messageId) : null,
    title: notification.title || data.title || 'ServEase',
    message: notification.body || data.body || '',
    type: data.type || 'general',
    requestId: data.requestRef || data.requestId || null,
    createdAt: Date.now(),
  };
}

export function formatTimeAgo(timestamp) {
  const time = new Date(timestamp).getTime();
  if (!time || Number.isNaN(time)) return 'Just now';
  const minutes = Math.floor(Math.max(0, Date.now() - time) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ------------------------------------------------------------------ */
/* Mark as read: POST /api/notifications/:id/read                      */
/* ------------------------------------------------------------------ */
// Uses the same fetch helper, JWT handling and API base URL as the rest of the app.
export async function markNotificationRead(id) {
  if (!id) return;
  try {
    await request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
  } catch (error) {
    // Non-fatal: the notifications table + polling stay the source of truth.
    console.warn('[push] markNotificationRead failed:', error?.message);
  } finally {
    useNotificationBannerStore.getState().refreshNotifications();
  }
}

/* ------------------------------------------------------------------ */
/* Opening a notification                                              */
/* ------------------------------------------------------------------ */
let pendingNotification = null;

const currentRouteName = (navigationRef) =>
  navigationRef?.isReady?.() ? navigationRef.getCurrentRoute()?.name : null;

const performOpen = (navigationRef, notification, routeName) => {
  markNotificationRead(notification.id);
  const route = buildRoute(
    notification.type,
    notification.requestId,
    PROVIDER_ROUTES.has(routeName)
  );
  if (route) navigationRef.navigate(route.name, route.params);
};

// Banner taps, background taps and quit-state taps all come through here.
export function openNotification(navigationRef, notification) {
  if (!notification) return;
  const routeName = currentRouteName(navigationRef);
  if (!routeName || AUTH_ROUTES.has(routeName)) {
    pendingNotification = notification; // app still starting / user not logged in yet
    return;
  }
  performOpen(navigationRef, notification, routeName);
}

// Called from App.js whenever the route changes.
export function flushPendingNotification(navigationRef) {
  if (!pendingNotification) return;
  const routeName = currentRouteName(navigationRef);
  if (!routeName || AUTH_ROUTES.has(routeName)) return;
  const notification = pendingNotification;
  pendingNotification = null;
  performOpen(navigationRef, notification, routeName);
}