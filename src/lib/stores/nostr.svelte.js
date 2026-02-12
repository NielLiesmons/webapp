/**
 * Reactive Nostr Store
 *
 * Provides reactive access to app data with cursor-based pagination.
 * Aligned with FEAT-001 spec:
 * - Apps ordered by release recency (most recent release first)
 * - Cursor-based pagination via "Load More" button
 * - Background refresh updates UI reactively
 *
 * @see spec/features/FEAT-001-apps-listing.md
 */
import { setBackgroundRefreshing } from '$lib/stores/refresh-indicator.svelte.js';
import { parseChunkHtmlPayload } from '$lib/utils/chunk-payload.js';
import { persistEventsInBackground } from '$lib/nostr/cache-writer.js';
const PAGE_SIZE = 24; // Fetch extra to account for duplicates, ensures ~16+ unique apps
// ============================================================================
// Reactive State
// ============================================================================
/** Apps list - ordered by release recency */
let apps = $state([]);
/** Cursor for next page (timestamp) */
let cursor = $state(null);
/** Whether more apps are available */
let hasMore = $state(true);
/** Loading state for "Load More" */
let loadingMore = $state(false);
/** Refreshing from relays in background */
let refreshing = $state(false);
/** Whether store has been initialized with prerendered data */
let initialized = $state(false);
/** Set of seen app keys for deduplication */
const seenApps = new Set();
// ============================================================================
// Public Reactive Getters
// ============================================================================
export function getApps() {
    return apps;
}
export function getHasMore() {
    return hasMore;
}
export function isLoadingMore() {
    return loadingMore;
}
export function isRefreshing() {
    return refreshing;
}
export function isStoreInitialized() {
    return initialized;
}
// ============================================================================
// Actions
// ============================================================================
/**
 * Initialize with prerendered data.
 * Call this on page load with SSG data.
 */
export function initWithPrerenderedData(prerenderedApps, nextCursor, seedEvents = []) {
    apps = prerenderedApps;
    cursor = nextCursor;
    hasMore = nextCursor !== null;
    // Track seen apps for deduplication
    seenApps.clear();
    for (const app of prerenderedApps) {
        seenApps.add(`${app.pubkey}:${app.dTag}`);
    }
    // Mark store as initialized (client now owns the data)
    initialized = true;
    persistEventsInBackground(seedEvents);
}

async function fetchAppsPageFromServer(limit, nextCursor) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (nextCursor !== undefined && nextCursor !== null) {
        params.set('cursor', String(nextCursor));
    }
    const response = await fetch(`/apps/chunk?${params.toString()}`);
    if (!response.ok) {
        throw new Error(`Apps chunk failed: ${response.status}`);
    }
    const html = await response.text();
    return parseChunkHtmlPayload(html);
}
/**
 * Refresh first page from server snapshot (background, non-blocking).
 * Keeps client-side relay traffic limited to explicit search flows.
 */
export async function refreshFromRelays() {
    if (refreshing)
        return;
    if (typeof window === 'undefined' || !navigator.onLine)
        return;
    refreshing = true;
    setBackgroundRefreshing(true);
    try {
        const { apps: freshApps, nextCursor, seedEvents = [] } = await fetchAppsPageFromServer(PAGE_SIZE);
        persistEventsInBackground(seedEvents);
        if (freshApps.length > 0) {
            // Deduplicate, maintaining release order
            const parsed = [];
            const newSeen = new Set();
            for (const app of freshApps) {
                const key = `${app.pubkey}:${app.dTag}`;
                if (!newSeen.has(key)) {
                    newSeen.add(key);
                    parsed.push(app);
                }
            }
            // Replace apps list with fresh data (maintains release order)
            apps = parsed;
            cursor = nextCursor;
            hasMore = nextCursor !== null;
            // Update seen set
            seenApps.clear();
            for (const key of newSeen) {
                seenApps.add(key);
            }
        }
    }
    catch (err) {
        console.error('[NostrStore] Refresh failed:', err);
    }
    finally {
        refreshing = false;
        setBackgroundRefreshing(false);
    }
}
/**
 * Load more apps (next page) from server snapshot.
 * Uses cursor-based pagination per FEAT-001 spec.
 */
export async function loadMore() {
    if (loadingMore || !hasMore || cursor === null)
        return;
    if (typeof window === 'undefined' || !navigator.onLine)
        return;
    loadingMore = true;
    try {
        const { apps: moreApps, nextCursor, seedEvents = [] } = await fetchAppsPageFromServer(PAGE_SIZE, cursor);
        persistEventsInBackground(seedEvents);
        if (moreApps.length > 0) {
            // Add only new apps (not seen before)
            const newApps = [];
            for (const app of moreApps) {
                const key = `${app.pubkey}:${app.dTag}`;
                if (!seenApps.has(key)) {
                    seenApps.add(key);
                    newApps.push(app);
                }
            }
            if (newApps.length > 0) {
                apps = [...apps, ...newApps];
            }
        }
        cursor = nextCursor;
        hasMore = nextCursor !== null;
    }
    catch (err) {
        console.error('[NostrStore] Load more failed:', err);
    }
    finally {
        loadingMore = false;
    }
}
/**
 * Schedule background refresh using requestIdleCallback.
 */
export function scheduleRefresh() {
    if (typeof window === 'undefined')
        return;
    const schedule = 'requestIdleCallback' in window
        ? window.requestIdleCallback
        : (cb) => setTimeout(cb, 1);
    schedule(() => {
        refreshFromRelays();
    });
}
/**
 * Reset store state (for testing or cleanup).
 */
export function resetStore() {
    apps = [];
    cursor = null;
    hasMore = true;
    loadingMore = false;
    refreshing = false;
    initialized = false;
    seenApps.clear();
}
