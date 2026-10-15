import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'servease.sidebarCollapsed';
const AUTO_COLLAPSE_QUERY = '(max-width: 900px)';

const readInitial = () => {
  if (typeof window === 'undefined') return false;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved === 'true';
  } catch {
    /* storage unavailable, fall through */
  }
  return window.matchMedia(AUTO_COLLAPSE_QUERY).matches;
};

// Lives at module level, so it is NOT reset when a sidebar unmounts/remounts on tab change.
let collapsed = readInitial();
const listeners = new Set();

const setCollapsed = (next, { persist = true } = {}) => {
  const value = typeof next === 'function' ? next(collapsed) : next;
  if (value === collapsed) return;
  collapsed = value;
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((listener) => listener());
};

// Responsive behavior: only reacts when the screen size actually crosses the breakpoint.
// Navigating between tabs never triggers this. The automatic change is not saved as the
// user's own choice.
if (typeof window !== 'undefined') {
  window
    .matchMedia(AUTO_COLLAPSE_QUERY)
    .addEventListener('change', (e) => setCollapsed(e.matches, { persist: false }));
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => collapsed;

// Usage: const [collapsed, setCollapsed] = useSidebarCollapsed();
// setCollapsed accepts a boolean or an updater function, like useState.
export default function useSidebarCollapsed() {
  const value = useSyncExternalStore(subscribe, getSnapshot, () => false);
  return [value, setCollapsed];
}