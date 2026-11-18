// utils/trackBadges.js
// Red "new" indicators for the customer's Track screen: one on each Track.js status tab
// (Pending / Active / Completed / Closed) and one on the Track icon of CustomerNavBar.
//
// How it works
//  - The backend does not store "seen" state for tracking cards, so it is kept on the device,
//    per account (AsyncStorage). A card is identified by a signature: its id plus the bits that
//    change when the provider does something (status label, finished steps, paid, amount).
//    So a NEW card, or an existing one the provider UPDATED, counts as new again.
//  - Two independent "seen" sets, so each indicator clears on its own tap:
//      tab -> cleared when that status tab on Track.js is tapped
//      nav -> cleared when the Track tab on the navigation bar is tapped (or Track is open)
//    Nav badge = cards that are neither tab-seen nor nav-seen.
//  - The first time an account is seen on this device, everything that already exists is treated
//    as seen, so installing / logging in does not light up every old request.
//  - Counts are always derived from the loaded tracking data. Nothing is hard-coded.
//
// Requires the screens using it to be inside the AuthProvider (useAuth).
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth_context';
import { getTrackedRequests } from '../api/servicerequest_api';

// Customer-facing tabs and the tracking groups ({ sent, approved, ongoing, declined, done }) feeding each.
export const TAB_SOURCES = {
    pending: ['sent'],
    active: ['approved', 'ongoing'],
    completed: ['done'],
    closed: ['declined'],
};
const TAB_KEYS = Object.keys(TAB_SOURCES);

// Cards that only ask the customer a question (Active > Quotations). Everything else in Active is On-going.
export const ACTION_CARD_TYPES = ['quotation', 'payment'];

const POLL_MS = 20000;
const storageKey = (owner) => `track_badges_seen:${owner}`;
const EMPTY_COUNTS = { pending: 0, active: 0, completed: 0, closed: 0, nav: 0 };

// ----- store (module level, shared by Track.js and CustomerNavBar.js) -----
const store = {
    owner: null,
    ready: Promise.resolve(),
    groups: null,
    baselined: false,
    seen: { tab: new Set(), nav: new Set() },
    snapshot: EMPTY_COUNTS,
};
const listeners = new Set();

// Same card + same provider progress = same signature.
const cardKey = (card) => {
    const doneSteps = (card.timeline || []).filter((step) => step.done).length;
    return [card.id, card.statusLabel ?? '', doneSteps, card.isPaid ? 1 : 0, card.paymentAmount ?? '', card.finalAmount ?? ''].join('|');
};

const keysByTab = (groups) =>
    Object.fromEntries(
        TAB_KEYS.map((tab) => [tab, TAB_SOURCES[tab].flatMap((source) => groups?.[source] ?? []).map(cardKey)]),
    );

const computeSnapshot = () => {
    if (!store.groups) return EMPTY_COUNTS;
    const byTab = keysByTab(store.groups);
    const counts = { nav: 0 };
    TAB_KEYS.forEach((tab) => {
        const unseen = byTab[tab].filter((key) => !store.seen.tab.has(key));
        counts[tab] = unseen.length;
        counts.nav += unseen.filter((key) => !store.seen.nav.has(key)).length;
    });
    return counts;
};

const emit = () => {
    store.snapshot = computeSnapshot();
    listeners.forEach((listener) => listener());
};

const persist = () => {
    if (!store.owner) return;
    AsyncStorage.setItem(
        storageKey(store.owner),
        JSON.stringify({ tab: [...store.seen.tab], nav: [...store.seen.nav] }),
    ).catch(() => {});
};

// Switches the store to this account (a different account starts from a clean slate).
const activate = (owner) => {
    if (store.owner === owner) return store.ready;
    store.owner = owner;
    store.groups = null;
    store.baselined = false;
    store.seen = { tab: new Set(), nav: new Set() };
    store.ready = owner
        ? AsyncStorage.getItem(storageKey(owner))
              .then((raw) => {
                  if (store.owner !== owner || !raw) return;
                  const saved = JSON.parse(raw);
                  store.seen = { tab: new Set(saved.tab || []), nav: new Set(saved.nav || []) };
                  store.baselined = true;
              })
              .catch(() => {})
        : Promise.resolve();
    emit();
    return store.ready;
};

const syncGroups = async (owner, groups) => {
    await activate(owner);
    if (!owner || store.owner !== owner || !groups) return;
    store.groups = groups;
    const keys = Object.values(keysByTab(groups)).flat();
    if (!store.baselined) {
        keys.forEach((key) => {
            store.seen.tab.add(key);
            store.seen.nav.add(key);
        });
        store.baselined = true;
    }
    // Forget signatures of cards that no longer exist so the stored sets don't grow forever.
    const live = new Set(keys);
    [store.seen.tab, store.seen.nav].forEach((set) => set.forEach((key) => !live.has(key) && set.delete(key)));
    persist();
    emit();
};

const markTabSeen = (tab) => {
    if (!store.groups || !TAB_SOURCES[tab]) return;
    keysByTab(store.groups)[tab].forEach((key) => store.seen.tab.add(key));
    persist();
    emit();
};

const markNavSeen = () => {
    if (!store.groups) return;
    Object.values(keysByTab(store.groups)).flat().forEach((key) => store.seen.nav.add(key));
    persist();
    emit();
};

// ----- hooks -----
const useOwnerKey = () => {
    const { user } = useAuth();
    return user?.id ?? user?.user_id ?? user?.email ?? null;
};

// Counts: { pending, active, completed, closed, nav } plus the actions that change them.
export const useTrackBadges = () => {
    const owner = useOwnerKey();
    const [counts, setCounts] = useState(store.snapshot);

    useEffect(() => {
        const listener = () => setCounts(store.snapshot);
        listeners.add(listener);
        activate(owner);
        listener();
        return () => listeners.delete(listener);
    }, [owner]);

    // Call with the response of getTrackedRequests() after every successful load.
    const sync = useCallback((groups) => syncGroups(owner, groups), [owner]);
    return { counts, sync, markTabSeen, markNavSeen };
};

// Keeps the badges live while the nav bar is visible (same idea as useChatUnreadPolling):
// loads the tracking data now, every POLL_MS while the app is in the foreground, and whenever
// `refreshKey` (the current route) changes.
export const useTrackBadgePolling = (enabled, refreshKey) => {
    const owner = useOwnerKey();
    const busy = useRef(false);

    const refresh = useCallback(async () => {
        if (!owner || busy.current) return;
        busy.current = true;
        try {
            await syncGroups(owner, await getTrackedRequests());
        } catch {
            // Offline or a server hiccup: keep the last known counts.
        } finally {
            busy.current = false;
        }
    }, [owner]);

    useEffect(() => {
        if (!enabled) return undefined;
        refresh();
        const timer = setInterval(() => AppState.currentState === 'active' && refresh(), POLL_MS);
        return () => clearInterval(timer);
    }, [enabled, refresh, refreshKey]);
};