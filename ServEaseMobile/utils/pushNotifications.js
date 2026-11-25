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
import { registerDeviceToken, unregisterDeviceToken } from '../api/client';
import { useNotificationBannerStore } from './notificationBannerStore';
import { normalizeRemoteMessage, openNotification } from './notificationActions';
import { refreshProviderBadgeCounts } from './providerTabBadges';

// Lazy + guarded: if google-services.json was missing at build time the native
// Firebase app never initialized, and touching the module would crash on launch.
let messaging = null;
try {
    messaging = require('@react-native-firebase/messaging').default;
} catch (error) {
    messaging = null;
}

const isAvailable = () => {
    if (Platform.OS !== 'android' || !messaging) return false;
    try {
        messaging(); // throws when Firebase isn't initialized (no google-services.json)
        return true;
    } catch (error) {
        return false;
    }
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
// token-safe setup result so registration failures are diagnosable on-device.
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
        showReleaseDiagnostic(
            'Notifications ready',
            'This device was registered successfully with the ServEase server.'
        );
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
    if (!isAvailable()) {
        console.warn('[push] Firebase Messaging is unavailable in this build');
        showReleaseDiagnostic(
            'Notification setup failed',
            'Firebase Messaging is unavailable in this installed build. Check the Google Services configuration.'
        );
        return undefined;
    }

    try {
        const granted = await askPermission();
        if (!granted) {
            // Token registration and the custom foreground banner still work when
            // Android's system-tray permission is denied. Do not abort setup here:
            // enabling permission later in Settings does not rerun this function.
            console.warn('[push] system notification permission is denied; foreground banners remain enabled');
        }

        const syncDeviceToken = async () => {
            const token = await getFcmToken();
            if (token) await registerFcmToken(token);
            else {
                showReleaseDiagnostic(
                    'Notification setup failed',
                    'Firebase returned an empty device token.'
                );
            }
        };

        // Install listeners before contacting the backend. A registration/network
        // failure must never prevent an incoming foreground message from displaying.
        const unsubscribeRefresh = messaging().onTokenRefresh((newToken) => {
            registerFcmToken(newToken);
        });
        const unsubscribeMessages = messaging().onMessage((remoteMessage) => {
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

        await syncDeviceToken();

        return () => {
            appStateSubscription.remove();
            unsubscribeRefresh();
            unsubscribeMessages();
        };
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

// Call on logout, BEFORE the auth token is cleared (the unregister call needs it).
export const teardownPushNotifications = async () => {
    if (!isAvailable()) return;
    try {
        const token = await getFcmToken();
        if (token) {
            await unregisterDeviceToken(token).catch(() => {});
            await messaging().deleteToken().catch(() => {});
        }
    } catch (error) {
        // Non-fatal: the token just dies on its own.
    }
};