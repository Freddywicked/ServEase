// utils/pushNotifications.js
// Firebase Cloud Messaging push notifications.
//
// Setup (one time, see the backend's utils/push.js header for the server half):
//   1. Firebase Console -> create project -> add an Android app with the package
//      name com.serveasemobile -> download google-services.json into
//      ServEaseMobile/android/app/ and rebuild the APK.
//   2. Project settings -> Service accounts -> Generate private key -> give the
//      JSON to the backend (FIREBASE_SERVICE_ACCOUNT_JSON env var on Render, or
//      FIREBASE_SERVICE_ACCOUNT_PATH locally).
// Without those, push setup reports why it is unavailable and the app continues
// working with its database-backed in-app notification list.
import { Alert, AppState, Platform, PermissionsAndroid } from 'react-native';
import { getToken as getAuthToken, registerDeviceToken, unregisterDeviceToken } from '../api/client';
import { useNotificationBannerStore } from './notificationBannerStore';
import { normalizeRemoteMessage, openNotification } from './notificationActions';
import { refreshProviderBadgeCounts } from './providerTabBadges';

// Lazy + guarded: if google-services.json was missing at build time the native
// Firebase app never initialized, and touching the module would crash on launch.
let messaging = null;
let messagingModuleError = null;
try {
    const messagingModule = require('@react-native-firebase/messaging');
    // v26 exports modular getMessaging(); older versions exported default messaging().
    messaging = messagingModule.getMessaging || messagingModule.default;
} catch (error) {
    messaging = null;
    messagingModuleError = error;
}

const messagingUnavailableReason = () => {
    if (Platform.OS !== 'android') return 'Firebase Messaging is currently configured for Android only.';
    if (!messaging) {
        return `The Firebase Messaging module could not load: ${messagingModuleError?.message || 'unknown module error'}`;
    }
    try {
        messaging();
        return null;
    } catch (error) {
        return `Firebase Messaging initialization failed: ${error.message || String(error)}`;
    }
};

const isAvailable = () => !messagingUnavailableReason();

// Token registration and logout cleanup must be serialized. Otherwise a slow
// registration can finish after logout and re-enable pushes for the old account.
let pushSessionId = 0;
let tokenOperationQueue = Promise.resolve();
const enqueueTokenOperation = (operation) => {
    const result = tokenOperationQueue.then(operation, operation);
    tokenOperationQueue = result.catch(() => {});
    return result;
};

// Android 13+ asks for POST_NOTIFICATIONS at runtime; older versions allow it
// by default. iOS would use messaging().requestPermission() instead.
const askPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
};

// A release phone without USB cannot show Metro's [push] logs. Surface one
// token-safe setup failure so registration problems are diagnosable on-device.
let releaseDiagnosticShown = false;
const showReleaseDiagnostic = (title, message) => {
    if (__DEV__ || releaseDiagnosticShown) return;
    releaseDiagnosticShown = true;
    Alert.alert(title, message);
};

const getFcmToken = async () => {
    try {
        return await messaging().getToken();
    } catch (error) {
        console.warn('[push] could not get FCM token:', error.message);
        showReleaseDiagnostic(
            'Notification setup failed',
            `Firebase could not create a device token.\n\n${error.message}`
        );
        return null;
    }
};

const registerFcmToken = async (token) => {
    try {
        await registerDeviceToken(token, Platform.OS);
        if (__DEV__) console.log('[push] device token registered');
    } catch (error) {
        // A backend/network failure must not disable foreground FCM listeners.
        // setupPushNotifications retries when the app next becomes active.
        console.warn('[push] device registration failed:', error.message);
        showReleaseDiagnostic(
            'Notification registration failed',
            `Firebase created a token, but the ServEase server could not register it.\n\n${error.message}`
        );
    }
};

// Call once the user is logged in (auth_context watches `user`). Registers the
// device with the backend, keeps the token fresh, and shows incoming pushes in
// the app-level banner while the app is in the FOREGROUND (in the background/quit
// state the system tray shows them automatically).
export const setupPushNotifications = async () => {
    const unavailableReason = messagingUnavailableReason();
    if (unavailableReason) {
        console.warn(`[push] ${unavailableReason}`);
        showReleaseDiagnostic('Notification setup failed', unavailableReason);
        return undefined;
    }

    const sessionId = ++pushSessionId;
    const isCurrentSession = () => sessionId === pushSessionId;

    try {
        const granted = await askPermission();
        if (!isCurrentSession()) return undefined;
        if (!granted) {
            // Token registration and the custom foreground banner still work when
            // Android's system-tray permission is denied. Do not abort setup here:
            // enabling permission later in Settings does not rerun this function.
            console.warn('[push] system notification permission is denied; foreground banners remain enabled');
        }

        const syncDeviceToken = () => enqueueTokenOperation(async () => {
            if (!isCurrentSession()) return;
            const token = await getFcmToken();
            if (!isCurrentSession()) return;
            if (token) await registerFcmToken(token);
            else {
                showReleaseDiagnostic(
                    'Notification setup failed',
                    'Firebase returned an empty device token.'
                );
            }
        });

        // Install listeners before contacting the backend. A registration/network
        // failure must never prevent an incoming foreground message from displaying.
        const unsubscribeRefresh = messaging().onTokenRefresh((newToken) => {
            enqueueTokenOperation(async () => {
                if (isCurrentSession()) await registerFcmToken(newToken);
            });
        });
        const unsubscribeMessages = messaging().onMessage((remoteMessage) => {
            // A callback already queued by the native side must not display a
            // banner after logout has invalidated this push session.
            if (!isCurrentSession()) return;
            const notification = normalizeRemoteMessage(remoteMessage);
            useNotificationBannerStore.getState().showNotification(notification);
            if (['new_request', 'quotation_accepted'].includes(notification.type)) {
                refreshProviderBadgeCounts();
            }
        });

        // Retry after a backend outage, and after returning from Android Settings.
        const appStateSubscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') return syncDeviceToken();
            return undefined;
        });
        const cleanup = () => {
            appStateSubscription.remove();
            unsubscribeRefresh();
            unsubscribeMessages();
        };

        await syncDeviceToken();
        if (!isCurrentSession()) {
            cleanup();
            return undefined;
        }
        return cleanup;
    } catch (error) {
        console.warn('[push] setup failed:', error.message);
        showReleaseDiagnostic('Notification setup failed', error.message);
        return undefined;
    }
};

// Taps on system-tray notifications. Call once from App.js with the navigationRef.
//   - app in background -> onNotificationOpenedApp
//   - app was quit      -> getInitialNotification
// Returns an unsubscribe function (or undefined when Firebase isn't available).
export const registerNotificationOpenHandlers = (navigationRef) => {
    if (!isAvailable()) return undefined;

    const unsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
        openNotification(navigationRef, normalizeRemoteMessage(remoteMessage));
    });

    messaging()
        .getInitialNotification()
        .then((remoteMessage) => {
            if (remoteMessage) openNotification(navigationRef, normalizeRemoteMessage(remoteMessage));
        })
        .catch(() => {});

    return unsubscribe;
};

// Call on logout, BEFORE the auth token is cleared when one is available.
// Always revokes the native token; the authenticated backend unregister is a
// best-effort additional step so other app instances do not retain the mapping.
export const teardownPushNotifications = async () => {
    // Invalidate callbacks immediately, then wait behind any in-flight registration.
    pushSessionId += 1;
    useNotificationBannerStore.getState().dismissNotification();

    return enqueueTokenOperation(async () => {
        if (!isAvailable()) return;

        let fcmToken = null;
        try {
            fcmToken = await messaging().getToken();
        } catch (error) {
            console.warn('[push] could not read token during teardown:', error.message);
        }

        // Session-expiry/startup cleanup has no JWT. Do not issue an
        // unauthenticated request that would trigger another 401 logout callback.
        const authToken = await getAuthToken().catch(() => null);
        if (fcmToken && authToken) {
            await unregisterDeviceToken(fcmToken).catch(() => {});
        }

        // This is the essential system-tray defense: FCM must no longer consider
        // the logged-out device's registration token valid.
        await messaging().deleteToken().catch(() => {});
    });
};