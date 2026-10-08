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
// Without those, every function here quietly no-ops and the app works as before
// (in-app notifications only).
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { registerDeviceToken, unregisterDeviceToken } from '../api/client';

// Lazy + guarded: if google-services.json was missing at build time the native
// Firebase app never initialized, and touching the module would crash on launch.
let messaging = null;
try {
    // eslint-disable-next-line global-require
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

const getFcmToken = async () => {
    try {
        return await messaging().getToken();
    } catch (error) {
        return null;
    }
};

// Call once the user is logged in (auth_context watches `user`). Registers the
// device with the backend, keeps the token fresh, and shows incoming pushes as
// an alert while the app is in the FOREGROUND (in the background/quit state the
// system tray shows them automatically).
export const setupPushNotifications = async () => {
    if (!isAvailable()) return undefined;

    try {
        const granted = await askPermission();
        if (!granted) return undefined;

        const token = await getFcmToken();
        if (token) await registerDeviceToken(token, Platform.OS);

        // Firebase rotates tokens occasionally; keep the backend's copy current.
        const unsubscribeRefresh = messaging().onTokenRefresh((newToken) => {
            registerDeviceToken(newToken, Platform.OS).catch(() => {});
        });

        // Foreground messages arrive here (the tray only shows them when the app
        // is in the background). Alert makes testing obvious; swap for a custom
        // banner later if it gets noisy.
        const unsubscribeMessages = messaging().onMessage((remoteMessage) => {
            const title = remoteMessage.notification?.title || 'ServEase';
            const body = remoteMessage.notification?.body || '';
            if (body) Alert.alert(title, body);
        });

        return () => {
            unsubscribeRefresh();
            unsubscribeMessages();
        };
    } catch (error) {
        console.warn('[push] setup failed:', error.message);
        return undefined;
    }
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
