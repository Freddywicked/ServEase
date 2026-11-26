import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { getToken, me, logout, setOnUnauthorized } from '../api/client';
import { setupPushNotifications, teardownPushNotifications } from '../utils/pushNotifications';
import { signOutGoogle } from '../utils/googleSignIn';

// Must match service_providers.verification_status for an approved provider
// (same value as VERIFIED in the backend's middleware/auth.js).
export const VERIFIED_STATUS = 'verified';

// Where a logged-in user should land. Every account is a customer (BR-02);
// only verified providers get the provider dashboard (BR-05).
export const homeRouteFor = (provider) =>
    provider?.verification_status === VERIFIED_STATUS ? 'ServiceProviderDashboard' : 'CustomerDashboard';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [provider, setProvider] = useState(null); // { verification_status } | null
    const [restoring, setRestoring] = useState(true); // true while the saved token is being checked

    // On app start: if a token is saved, ask the backend who it belongs to.
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const token = await getToken();
                if (!token) {
                    // A previous installation/session may have left a native FCM
                    // token alive even though there is no ServEase session.
                    await teardownPushNotifications();
                    return;
                }
                const data = await me();
                if (active) {
                    setUser(data.user);
                    setProvider(data.provider);
                }
            } catch (err) {
                // 401: client.js already removed the token, so the user is logged out.
                // Network error: stay logged out for now; the token is kept for next launch.
                // In either case this device must not receive account pushes while logged out.
                await teardownPushNotifications();
            } finally {
                if (active) setRestoring(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    // Any logged-in request that returns 401 logs the user out here.
    useEffect(() => {
        setOnUnauthorized(() => {
            setUser(null);
            setProvider(null);
            // The JWT has already been removed by client.js. Teardown therefore
            // skips the authenticated backend call but still revokes FCM locally.
            teardownPushNotifications();
        });
        return () => setOnUnauthorized(null);
    }, []);

    // FCM push notifications: while logged in, this device's token is registered
    // with the backend so every notification also arrives as a push. No-ops until
    // google-services.json exists (see utils/pushNotifications.js).
    useEffect(() => {
        if (!user) return undefined;
        let cleanup;
        let cancelled = false;
        setupPushNotifications().then((fn) => {
            // Setup can finish after logout/user refresh. Never leave its native
            // listeners alive in that case.
            if (cancelled) fn?.();
            else cleanup = fn;
        });
        return () => {
            cancelled = true;
            cleanup?.();
        };
    }, [user]);

    // Re-fetch user + provider status (e.g. after submitting a provider application).
    const refreshUser = useCallback(async () => {
        const data = await me();
        setUser(data.user);
        setProvider(data.provider);
        return data;
    }, []);

    // Returning within the seven-day window renews both the JWT and the
    // role-specific session. An expired token follows the normal 401 cleanup.
    useEffect(() => {
        if (!user) return undefined;
        let lastResumeCheck = 0;
        const renewSession = () => refreshUser().catch(() => {});
        const subscription = AppState.addEventListener('change', (state) => {
            if (state !== 'active' || Date.now() - lastResumeCheck < 60000) return;
            lastResumeCheck = Date.now();
            renewSession();
        });
        const renewalTimer = setInterval(() => {
            if (AppState.currentState === 'active') renewSession();
        }, 12 * 60 * 60 * 1000);
        return () => {
            clearInterval(renewalTimer);
            subscription.remove();
        };
    }, [user, refreshUser]);

    const signOut = useCallback(async () => {
        // Forget the Google session too, so the next Google sign-in shows the
        // account picker instead of silently re-using the same account.
        // Best-effort: never blocks signing out of ServEase itself.
        await signOutGoogle();
        // Unregister first — the call needs the auth token that logout() clears.
        // Always clear the local session, even if native/network cleanup fails.
        try {
            await teardownPushNotifications();
        } finally {
            await logout();
            setUser(null);
            setProvider(null);
        }
    }, []);

    const value = useMemo(
        () => ({
            user,
            setUser,
            provider,
            setProvider,
            restoring,
            isAuthenticated: !!user,
            refreshUser,
            signOut,
        }),
        [user, provider, restoring, refreshUser, signOut]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
};