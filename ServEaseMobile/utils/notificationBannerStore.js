// utils/notificationBannerStore.js
//
// Shared state between the FCM foreground listener (outside React) and the
// <NotificationBanner /> (inside React).
//
// Outside React (e.g. pushNotifications.js):
//   useNotificationBannerStore.getState().showNotification(notification)
//
// Zustand v4/v5 named import. If your project is on Zustand v3, change to:
//   import create from 'zustand';
import { create } from 'zustand';

const MAX_REMEMBERED_DELIVERY_IDS = 50;
let seenDeliveryIds = [];
let keyCounter = 0;

export const useNotificationBannerStore = create((set) => ({
  // The notification currently shown (or null).
  current: null,

  // Bumps every time a NEW notification arrives (or refreshNotifications()
  // is called). Hooks such as useNotificationBadge subscribe to this so the
  // bell badge / lists refresh immediately instead of waiting for polling.
  receivedTick: 0,

  showNotification: (notification) => {
    if (!notification) return;

    // The database ID is still needed for marking the notification as read.
    const id = notification.id != null ? String(notification.id) : null;

    // De-duplicate repeated callbacks for one FCM delivery. Do not key this by
    // backend notificationId: sending that notification again is a new delivery
    // and must produce a new banner.
    const deliveryId = notification.deliveryId != null ? String(notification.deliveryId) : null;
    if (deliveryId) {
      if (seenDeliveryIds.includes(deliveryId)) return;
      seenDeliveryIds = [...seenDeliveryIds, deliveryId].slice(-MAX_REMEMBERED_DELIVERY_IDS);
    }

    keyCounter += 1;
    set((state) => ({
      // Newest notification replaces the one on screen.
      current: {
        ...notification,
        id,
        deliveryId,
        key: keyCounter,
        createdAt: notification.createdAt || Date.now(),
      },
      receivedTick: state.receivedTick + 1,
    }));
  },

  // Only clears if the banner being dismissed is still the current one,
  // so a late dismiss never removes a newer notification.
  dismissNotification: (key) =>
    set((state) =>
      key == null || state.current?.key === key ? { current: null } : state
    ),

  // Ask listeners (badge hook, notifications modal, etc.) to refresh.
  refreshNotifications: () =>
    set((state) => ({ receivedTick: state.receivedTick + 1 })),
}));