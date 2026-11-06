// Google Sign-In for the mobile app.
//
// The heavy lifting is done by @react-native-google-signin/google-signin (native
// module), configured here with the WEB OAuth client ID from Google Cloud Console
// (project servease-510d3 > APIs & Services > Credentials). It MUST be the Web
// client, not the Android one: the ID token Google returns is then addressed
// (audience) to the web client, which is exactly what the backend verifies
// (ServEaseBackend .env GOOGLE_CLIENT_IDS, POST /api/auth/google).
//
// Requires android/app/google-services.json downloaded AFTER the app's SHA-1
// fingerprint was added in the Firebase console — otherwise every sign-in fails
// with DEVELOPER_ERROR (code 10).

const WEB_CLIENT_ID = '299475570445-jigm82j3fc3m5224datdh5haes9gmp8u.apps.googleusercontent.com';

// Lazy require: importing the native module at file scope would crash Jest and
// any JS context where the native side isn't linked yet.
const getGoogleSigninModule = () => require('@react-native-google-signin/google-signin');

let configured = false;
const ensureConfigured = () => {
    if (configured) return;
    const { GoogleSignin } = getGoogleSigninModule();
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, offlineAccess: false });
    configured = true;
};

// Opens the Google account picker, then exchanges the resulting ID token with our
// backend for a ServEase session. Resolves to { user, provider, needsPhone }.
// Throws an Error with .cancelled === true when the user dismisses the picker —
// callers should treat that as a no-op, not an error.
export const signInWithGoogle = async () => {
    ensureConfigured();
    const { GoogleSignin, statusCodes } = getGoogleSigninModule();
    // Lazy require too, so this util never pulls the API layer into a test bundle.
    const { loginWithGoogle } = require('../api/client');
    try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        const idToken = response?.data?.idToken;
        if (!idToken) throw new Error('Google did not return an ID token. Please try again.');
        return await loginWithGoogle(idToken);
    } catch (error) {
        if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
            const cancelled = new Error('Sign-in cancelled');
            cancelled.cancelled = true;
            throw cancelled;
        }
        if (error?.code === statusCodes.DEVELOPER_ERROR) {
            throw new Error(
                'Google sign-in is misconfigured (DEVELOPER_ERROR). Re-check the SHA-1 fingerprint in Firebase and that google-services.json is up to date.'
            );
        }
        throw error;
    }
};

// Forget the Google account on this device so the account picker appears next
// time. Best-effort: failures must never block signing out of ServEase itself.
export const signOutGoogle = async () => {
    try {
        ensureConfigured();
        const { GoogleSignin } = getGoogleSigninModule();
        await GoogleSignin.signOut();
    } catch {
        // Not signed in via Google, or native module unavailable — both fine.
    }
};
