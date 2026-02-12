/**
 * Reactive Stacks Store
 *
 * Provides reactive access to app stacks with cursor-based pagination.
 * Mirrors nostr.svelte.ts pattern for consistency.
 */
import { initNostrService, fetchAppStacks, fetchEvents } from '$lib/nostr/service';
import { parseAppStack, parseApp } from '$lib/nostr/models';
import { DEFAULT_CATALOG_RELAYS, EVENT_KINDS, PLATFORM_FILTER } from '$lib/config';
import { setBackgroundRefreshing } from '$lib/stores/refresh-indicator.svelte.js';
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
export function initWithPrerenderedStacks(prerenderedStacks, nextCursor) {
    stacks = prerenderedStacks;
    cursor = nextCursor;
    hasMore = nextCursor !== null;
    seenStacks.clear();
    for (const stack of prerenderedStacks) {
        seenStacks.add(`${stack.pubkey}:${stack.dTag}`);
    }
    initialized = true;
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
        await initNostrService();
        const { stacks: freshStacks, nextCursor } = await fetchAppStacks([...DEFAULT_CATALOG_RELAYS], PAGE_SIZE);
        if (freshStacks.length > 0) {
            const parsed = [];
            const newSeen = new Set();
            for (const event of freshStacks) {
                const stack = parseAppStack(event);
                const key = `${stack.pubkey}:${stack.dTag}`;
                if (!newSeen.has(key)) {
                    newSeen.add(key);
                    parsed.push(stack);
                }
            }
            stacks = parsed;
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
        await initNostrService();
        const { stacks: moreStacks, nextCursor } = await fetchAppStacks([...DEFAULT_CATALOG_RELAYS], PAGE_SIZE, cursor);
        if (moreStacks.length > 0) {
            const newStacks = [];
            for (const event of moreStacks) {
                const stack = parseAppStack(event);
                const key = `${stack.pubkey}:${stack.dTag}`;
                if (!seenStacks.has(key)) {
                    seenStacks.add(key);
                    newStacks.push(stack);
                }
            }
            if (newStacks.length > 0) {
                stacks = [...stacks, ...newStacks];
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
    if (typeof window === 'undefined' || stack.appRefs.length === 0)
        return [];
    await initNostrService();
    // Group refs by pubkey for batched fetching
    const refsByPubkey = new Map();
    for (const ref of stack.appRefs) {
        const existing = refsByPubkey.get(ref.pubkey) || [];
        existing.push(ref.identifier);
        refsByPubkey.set(ref.pubkey, existing);
    }
    // Fetch all groups in parallel (one request per pubkey group)
    const appsByKey = new Map();
    await Promise.all(Array.from(refsByPubkey.entries()).map(async ([pubkey, identifiers]) => {
        const events = await fetchEvents({
            kinds: [EVENT_KINDS.APP],
            authors: [pubkey],
            '#d': identifiers,
            ...PLATFORM_FILTER
        }, { relays: [...DEFAULT_CATALOG_RELAYS] });
        for (const ev of events) {
            const app = parseApp(ev);
            appsByKey.set(`${app.pubkey}:${app.dTag}`, app);
        }
    }));
    // Return in original appRefs order
    const apps = [];
    for (const ref of stack.appRefs) {
        const app = appsByKey.get(`${ref.pubkey}:${ref.identifier}`);
        if (app)
            apps.push(app);
    }
    return apps;
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
    await initNostrService();
    // Collect all unique app refs across all stacks
    const allRefs = new Map();
    for (const stack of stacksList) {
        for (const ref of stack.appRefs) {
            allRefs.set(`${ref.pubkey}:${ref.identifier}`, ref);
        }
    }
    // Batch fetch: group by pubkey, one request per group, all in parallel
    const refsByPubkey = new Map();
    for (const [, ref] of allRefs) {
        const existing = refsByPubkey.get(ref.pubkey) || [];
        existing.push(ref.identifier);
        refsByPubkey.set(ref.pubkey, existing);
    }
    const appsByKey = new Map();
    if (refsByPubkey.size > 0) {
        await Promise.all(Array.from(refsByPubkey.entries()).map(async ([pubkey, identifiers]) => {
            const events = await fetchEvents({
                kinds: [EVENT_KINDS.APP],
                authors: [pubkey],
                '#d': identifiers,
                ...PLATFORM_FILTER
            }, { relays: [...DEFAULT_CATALOG_RELAYS] });
            for (const ev of events) {
                const app = parseApp(ev);
                appsByKey.set(`${app.pubkey}:${app.dTag}`, app);
            }
        }));
    }
    // Map resolved apps back to each stack, preserving appRefs order
    return stacksList.map((stack) => {
        const apps = [];
        for (const ref of stack.appRefs) {
            const app = appsByKey.get(`${ref.pubkey}:${ref.identifier}`);
            if (app)
                apps.push(app);
        }
        return { stack, apps };
    });
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
    cursor = null;
    hasMore = true;
    loadingMore = false;
    refreshing = false;
    initialized = false;
    seenStacks.clear();
}
