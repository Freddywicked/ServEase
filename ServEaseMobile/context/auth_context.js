import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getToken, me, logout, setOnUnauthorized } from '../api/client';
import { setupPushNotifications, teardownPushNotifications } from '../utils/pushNotifications';

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
                if (!token) return;
                const data = await me();
                if (active) {
                    setUser(data.user);
                    setProvider(data.provider);
                }
            } catch (err) {
                // 401: client.js already removed the token, so the user is logged out.
                // Network error: stay logged out for now; the token is kept for next launch.
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
        });
        return () => setOnUnauthorized(null);
    }, []);

    // FCM push notifications: while logged in, this device's token is registered
    // with the backend so every notification also arrives as a push. No-ops until
    // google-services.json exists (see utils/pushNotifications.js).
    useEffect(() => {
        if (!user) return undefined;
        let cleanup;
        setupPushNotifications().then((fn) => {
            cleanup = fn;
        });
        return () => cleanup?.();
    }, [user]);

    // Re-fetch user + provider status (e.g. after submitting a provider application).
    const refreshUser = useCallback(async () => {
        const data = await me();
        setUser(data.user);
        setProvider(data.provider);
        return data;
    }, []);

    const signOut = useCallback(async () => {
        // Unregister first — the call needs the auth token that logout() clears.
        await teardownPushNotifications();
        await logout();
        setUser(null);
        setProvider(null);
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