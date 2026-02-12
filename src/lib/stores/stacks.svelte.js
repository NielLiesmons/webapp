/**
 * Reactive Stacks Store
 *
 * Provides reactive access to app stacks with cursor-based pagination.
 * Mirrors nostr.svelte.ts pattern for consistency.
 */
import { setBackgroundRefreshing } from '$lib/stores/refresh-indicator.svelte.js';
import { parseChunkHtmlPayload } from '$lib/utils/chunk-payload.js';
import { persistEventsInBackground } from '$lib/nostr/cache-writer.js';
const PAGE_SIZE = 20;
// ============================================================================
// Reactive State
// ============================================================================
/** Stacks list - ordered by created_at */
let stacks = $state([]);
/** Cursor for next page (timestamp) */
let cursor = $state(null);
/** Whether more stacks are available */
let hasMore = $state(true);
/** Loading state for "Load More" */
let loadingMore = $state(false);
/** Refreshing from relays in background */
let refreshing = $state(false);
/** Whether store has been initialized */
let initialized = $state(false);
/** Set of seen stack keys for deduplication */
const seenStacks = new Set();
/** Cached resolved stacks with apps and creator info */
let resolvedStacksCache = $state([]);
// ============================================================================
// Public Reactive Getters
// ============================================================================
export function getStacks() {
    return stacks;
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
export function isStacksInitialized() {
    return initialized;
}
export function getResolvedStacks() {
    return resolvedStacksCache;
}
export function setResolvedStacks(stacks) {
    resolvedStacksCache = stacks;
}
// ============================================================================
// Actions
// ============================================================================
/**
 * Initialize with prerendered data.
 */
export function initWithPrerenderedStacks(prerenderedStacks, prerenderedResolvedStacks, nextCursor, seedEvents = []) {
    stacks = prerenderedStacks;
    resolvedStacksCache = prerenderedResolvedStacks ?? [];
    cursor = nextCursor;
    hasMore = nextCursor !== null;
    seenStacks.clear();
    for (const stack of prerenderedStacks) {
        seenStacks.add(`${stack.pubkey}:${stack.dTag}`);
    }
    initialized = true;
    persistEventsInBackground(seedEvents);
}

async function fetchStacksPageFromServer(limit, nextCursor) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (nextCursor !== undefined && nextCursor !== null) {
        params.set('cursor', String(nextCursor));
    }
    const response = await fetch(`/stacks/chunk?${params.toString()}`);
    if (!response.ok) {
        throw new Error(`Stacks chunk failed: ${response.status}`);
    }
    const html = await response.text();
    return parseChunkHtmlPayload(html);
}
/**
 * Refresh stacks from relays (background, non-blocking).
 */
export async function refreshStacksFromRelays() {
    if (refreshing)
        return;
    if (typeof window === 'undefined' || !navigator.onLine)
        return;
    refreshing = true;
    setBackgroundRefreshing(true);
    try {
        const { stacks: freshStacks, resolvedStacks: freshResolvedStacks = [], nextCursor, seedEvents = [] } = await fetchStacksPageFromServer(PAGE_SIZE);
        persistEventsInBackground(seedEvents);
        if (freshStacks.length > 0) {
            const parsed = [];
            const newSeen = new Set();
            for (const stack of freshStacks) {
                const key = `${stack.pubkey}:${stack.dTag}`;
                if (!newSeen.has(key)) {
                    newSeen.add(key);
                    parsed.push(stack);
                }
            }
            stacks = parsed;
            resolvedStacksCache = freshResolvedStacks;
            cursor = nextCursor;
            hasMore = nextCursor !== null;
            seenStacks.clear();
            for (const key of newSeen) {
                seenStacks.add(key);
            }
        }
    }
    catch (err) {
        console.error('[StacksStore] Refresh failed:', err);
    }
    finally {
        initialized = true;
        refreshing = false;
        setBackgroundRefreshing(false);
    }
}
/**
 * Load more stacks (next page) from relays.
 */
export async function loadMoreStacks() {
    if (loadingMore || !hasMore || cursor === null)
        return;
    if (typeof window === 'undefined' || !navigator.onLine)
        return;
    loadingMore = true;
    try {
        const { stacks: moreStacks, resolvedStacks: moreResolvedStacks = [], nextCursor, seedEvents = [] } = await fetchStacksPageFromServer(PAGE_SIZE, cursor);
        persistEventsInBackground(seedEvents);
        if (moreStacks.length > 0) {
            const newStacks = [];
            for (const stack of moreStacks) {
                const key = `${stack.pubkey}:${stack.dTag}`;
                if (!seenStacks.has(key)) {
                    seenStacks.add(key);
                    newStacks.push(stack);
                }
            }
            if (newStacks.length > 0) {
                stacks = [...stacks, ...newStacks];
            }
            if (moreResolvedStacks.length > 0) {
                resolvedStacksCache = [...resolvedStacksCache, ...moreResolvedStacks];
            }
        }
        cursor = nextCursor;
        hasMore = nextCursor !== null;
    }
    catch (err) {
        console.error('[StacksStore] Load more failed:', err);
    }
    finally {
        loadingMore = false;
    }
}
/**
 * Resolve apps for a stack's app references.
 * Batches refs by pubkey and fetches in parallel (not sequential).
 * Returns the apps in the same order as the stack's appRefs.
 */
export async function resolveStackApps(stack) {
    if (!stack?.pubkey || !stack?.dTag)
        return [];
    const key = `${stack.pubkey}:${stack.dTag}`;
    const resolved = resolvedStacksCache.find((entry) => `${entry.stack.pubkey}:${entry.stack.dTag}` === key);
    return resolved?.apps ?? [];
}
/**
 * Resolve apps for MULTIPLE stacks in a single batched operation.
 * Collects all unique app refs across all stacks, groups by pubkey,
 * fetches in parallel, and maps results back to each stack.
 *
 * Far more efficient than calling resolveStackApps for each stack.
 */
export async function resolveMultipleStackApps(stacksList) {
    if (typeof window === 'undefined' || stacksList.length === 0)
        return [];
    const resolved = await Promise.all(stacksList.map(async (stack) => ({
        stack,
        apps: await resolveStackApps(stack)
    })));
    return resolved;
}
/**
 * Schedule background refresh using requestIdleCallback.
 */
export function scheduleStacksRefresh() {
    if (typeof window === 'undefined')
        return;
    const schedule = 'requestIdleCallback' in window
        ? window.requestIdleCallback
        : (cb) => setTimeout(cb, 1);
    schedule(() => {
        refreshStacksFromRelays();
    });
}
/**
 * Reset store state.
 */
export function resetStacksStore() {
    stacks = [];
    resolvedStacksCache = [];
    cursor = null;
    hasMore = true;
    loadingMore = false;
    refreshing = false;
    initialized = false;
    seenStacks.clear();
}
