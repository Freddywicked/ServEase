import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
// Add these two functions to api/servicerequest_api.js (see the notes in the reply):
//   getProviderBadgeCounts()      GET  /provider/badge-counts        -> { requests, jobs }
//   markProviderBadgeSeen(tab)    POST /provider/badge-counts/seen   body { tab: 'requests' | 'jobs' }
import { getProviderBadgeCounts, markProviderBadgeSeen } from '../api/servicerequest_api';
import { POLL_INTERVAL_MS } from '../constants/messaging';

/* ============================================================================
 * Unread counters for the service provider's Requests and Jobs tabs.
 *
 * - The numbers come from the backend (polled while the nav bar is visible, and
 *   refreshed whenever the app returns to the foreground).
 * - "Seen" is stored on the backend too, so the badge stays cleared after a restart
 *   and on other devices.
 * - Tapping a tab (or otherwise landing on its screen) clears its badge immediately and
 *   tells the backend; a poll that was already in flight can't bring the badge back.
 * - For instant updates, call refreshProviderBadgeCounts() from the FCM foreground handler.
 * ========================================================================== */

const EMPTY_COUNTS = { requests: 0, jobs: 0 };

let counts = EMPTY_COUNTS;
let localVersion = 0; // bumped on every local clear; older poll results are then discarded
let pendingSeenCalls = 0;
let viewingTab = null; // 'requests' | 'jobs' while the provider is ON that tab's screen

const countListeners = new Set();
const activityListeners = { requests: new Set(), jobs: new Set() };

const toCount = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
};

const publish = (next) => {
    counts = next;
    countListeners.forEach((listener) => listener(next));
};

// Clears one badge right away and records it on the backend.
export const markProviderTabSeen = async (tab) => {
    if (!tab) return;
    localVersion += 1;
    publish({ ...counts, [tab]: 0 });
    pendingSeenCalls += 1;
    try {
        await markProviderBadgeSeen(tab);
    } catch (error) {
        // Not recorded: the next poll will restore the badge, which is the honest state.
    } finally {
        pendingSeenCalls -= 1;
    }
};

export const refreshProviderBadgeCounts = async () => {
    if (pendingSeenCalls > 0 || AppState.currentState !== 'active') return;
    const startedAt = localVersion;
    let data;
    try {
        data = await getProviderBadgeCounts();
    } catch (error) {
        return; // keep the last known numbers, try again on the next tick
    }
    if (startedAt !== localVersion || pendingSeenCalls > 0) return;

    const next = { requests: toCount(data?.requests), jobs: toCount(data?.jobs) };

    // The provider is looking at this tab right now, so new items are not "unseen":
    // keep the badge at 0 and tell that screen to reload itself instead.
    if (viewingTab && next[viewingTab] > 0) {
        const tab = viewingTab;
        next[tab] = 0;
        publish(next);
        activityListeners[tab].forEach((listener) => listener());
        markProviderTabSeen(tab);
        return;
    }

    if (next.requests !== counts.requests || next.jobs !== counts.jobs) publish(next);
};

// Called by the nav bar with the tab whose screen is focused (or null).
export const setProviderViewingTab = (tab) => {
    viewingTab = tab || null;
    if (viewingTab && counts[viewingTab] > 0) markProviderTabSeen(viewingTab);
};

// A screen can reload itself when new items arrive while it is open.
export const subscribeToProviderTabActivity = (tab, listener) => {
    activityListeners[tab].add(listener);
    return () => activityListeners[tab].delete(listener);
};

// Call on logout (next to resetUnread() from chatUnread.js) so the next account never sees these numbers.
export const resetProviderBadges = () => {
    localVersion += 1;
    viewingTab = null;
    publish(EMPTY_COUNTS);
};

export const useProviderBadgeCounts = () => {
    const [value, setValue] = useState(counts);
    useEffect(() => {
        countListeners.add(setValue);
        setValue(counts);
        return () => {
            countListeners.delete(setValue);
        };
    }, []);
    return value;
};

export const useProviderBadgePolling = (enabled) => {
    useEffect(() => {
        if (!enabled) return undefined;
        refreshProviderBadgeCounts();
        const interval = setInterval(refreshProviderBadgeCounts, POLL_INTERVAL_MS);
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') refreshProviderBadgeCounts();
        });
        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, [enabled]);
};