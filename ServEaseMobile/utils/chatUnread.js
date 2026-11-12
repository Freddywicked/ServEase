import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { getConversations } from '../api/providerWork_api';
import { POLL_INTERVAL_MS } from '../constants/messaging';

/**
 * Shared unread-chat store for BOTH roles (GET /conversations is role-aware).
 *
 * The number on the Chat tab = number of conversations that currently have unread
 * messages. Nothing is hard coded: the set of unread thread ids is rebuilt from the
 * backend on every poll, so
 *   - a new message in a NEW thread adds an id  -> the number goes up
 *   - opening an unread thread removes its id   -> the number goes down by one
 *   - opening the Chat tab itself changes nothing
 *
 * The navbar lives outside the navigator, so this is a plain module-level store
 * (no provider needed) that the navbar and the chat screens all share.
 */

const PENDING_READ_TTL_MS = 15000;

let unreadIds = new Set();
// Threads the user just opened. A poll that was already in flight when the thread was
// opened could still say "unread"; ignore that until the server confirms it is read.
const pendingRead = new Map(); // id -> expiry timestamp
let activeConversationId = null; // thread currently on screen
const listeners = new Set();

const commit = (next) => {
    const same = next.size === unreadIds.size && [...next].every((id) => unreadIds.has(id));
    if (same) return;
    unreadIds = next;
    listeners.forEach((listener) => listener(unreadIds.size));
};

/** Rebuild the unread set from a fresh GET /conversations list. */
export const syncUnreadFromConversations = (conversations = []) => {
    const now = Date.now();
    const next = new Set();
    conversations.forEach((c) => {
        const id = String(c.id);
        if (!c.hasUnread) {
            pendingRead.delete(id); // server confirmed it is read
            return;
        }
        if (id === activeConversationId) return; // being read right now
        const expiry = pendingRead.get(id);
        if (expiry && expiry > now) return; // just opened, server not caught up yet
        pendingRead.delete(id);
        next.add(id);
    });
    commit(next);
};

/** Call when the user opens a thread: it stops counting as unread immediately. */
export const openConversation = (conversationId) => {
    if (conversationId == null) return;
    const id = String(conversationId);
    activeConversationId = id;
    pendingRead.set(id, Date.now() + PENDING_READ_TTL_MS);
    const next = new Set(unreadIds);
    next.delete(id);
    commit(next);
};

/** Call when the thread screen loses focus / unmounts. */
export const closeConversation = (conversationId) => {
    if (conversationId != null && String(conversationId) === activeConversationId) {
        activeConversationId = null;
    }
};

/** Optional: call on logout so the next account never sees the previous count. */
export const resetUnread = () => {
    pendingRead.clear();
    activeConversationId = null;
    commit(new Set());
};

/** Live number for the Chat tab badge. */
export const useChatUnreadCount = () => {
    const [count, setCount] = useState(unreadIds.size);
    useEffect(() => {
        listeners.add(setCount);
        setCount(unreadIds.size);
        return () => {
            listeners.delete(setCount);
        };
    }, []);
    return count;
};

/** Polls the backend while `enabled` (navbar visible = user is signed in). */
export const useChatUnreadPolling = (enabled) => {
    useEffect(() => {
        if (!enabled) return undefined;
        let cancelled = false;

        const refresh = async () => {
            if (AppState.currentState !== 'active') return;
            try {
                const data = await getConversations();
                if (!cancelled) syncUnreadFromConversations(data?.conversations ?? []);
            } catch (error) {
                // Keep the last known count. A 401 is already handled by api/client.
            }
        };

        refresh();
        const timer = setInterval(refresh, POLL_INTERVAL_MS);
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') refresh();
        });
        return () => {
            cancelled = true;
            clearInterval(timer);
            sub.remove();
        };
    }, [enabled]);
};