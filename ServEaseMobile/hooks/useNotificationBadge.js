import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getUnreadNotificationCount, markNotificationsSeen } from '../api/servicerequest_api';

// How often the badge re-checks the backend while the screen is focused and the app is open.
const POLL_INTERVAL_MS = 10000;

/**
 * Live unread-notification count, always read from the backend.
 * - refreshes on focus, when the app returns to the foreground, and on a short poll
 * - markSeen() clears the badge instantly, then tells the backend so it stays cleared
 * - refresh() is exposed so a push (FCM onMessage) listener can trigger an immediate update
 */
const useNotificationBadge = ({ audience } = {}) => {
    const [count, setCount] = useState(0);
    const ticketRef = useRef(0);
    const pausedRef = useRef(false);

    const refresh = useCallback(async () => {
        if (pausedRef.current) return;
        const ticket = ++ticketRef.current;
        try {
            const next = await getUnreadNotificationCount({ audience });
            // Ignore stale responses (e.g. one that was in flight while the user tapped the bell)
            if (ticket === ticketRef.current && !pausedRef.current) setCount(next);
        } catch (error) {
            // keep the last known count on network errors
        }
    }, [audience]);

    const markSeen = useCallback(async () => {
        ticketRef.current += 1;
        pausedRef.current = true;
        setCount(0);
        try {
            await markNotificationsSeen({ audience });
        } catch (error) {
            // if it failed, the refresh below restores the real count from the backend
        } finally {
            pausedRef.current = false;
            refresh();
        }
    }, [audience, refresh]);

    useFocusEffect(
        useCallback(() => {
            refresh();
            const timer = setInterval(() => {
                if (AppState.currentState === 'active') refresh();
            }, POLL_INTERVAL_MS);
            const subscription = AppState.addEventListener('change', (state) => {
                if (state === 'active') refresh();
            });
            return () => {
                clearInterval(timer);
                subscription.remove();
            };
        }, [refresh]),
    );

    return { count, markSeen, refresh };
};

export default useNotificationBadge;