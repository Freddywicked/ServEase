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

const MAX_REMEMBERED_IDS = 50;
let seenIds = [];
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

    // De-duplicate by backend notificationId.
    const id = notification.id != null ? String(notification.id) : null;
    if (id) {
      if (seenIds.includes(id)) return;
      seenIds = [...seenIds, id].slice(-MAX_REMEMBERED_IDS);
    }

    keyCounter += 1;
    set((state) => ({
      // Newest notification replaces the one on screen.
      current: {
        ...notification,
        id,
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