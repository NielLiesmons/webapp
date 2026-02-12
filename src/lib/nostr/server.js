/**
 * Server-side Nostr utilities backed by relay.db (SQLite).
 *
 * This module intentionally avoids request-time relay websocket fetching.
 * It reads catalog data from SQLite only (Option A).
 */
import {
    fetchAppsByReleases,
    fetchApp,
    fetchLatestReleaseForApp,
    fetchReleasesForApp,
    fetchStacks as fetchStacksFromDb,
    fetchStack,
    fetchAppsByAuthor,
    fetchStacksByAuthor,
    closeServerDb
} from './server-db';

const STACKS_CACHE_TTL_MS = 30_000;
const stacksCache = new Map();
const stacksInflight = new Map();

function getStacksCacheKey(limit, until) {
    return `${limit}:${until ?? 'first-page'}`;
}

async function loadAndCacheStacks(key, limit, until) {
    const result = await fetchStacksFromDb(limit, until);
    stacksCache.set(key, {
        value: result,
        expiresAt: Date.now() + STACKS_CACHE_TTL_MS
    });
    return result;
}

export async function fetchStacks(limit = 20, until) {
    const key = getStacksCacheKey(limit, until);
    const now = Date.now();
    const cached = stacksCache.get(key);

    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    const inflight = stacksInflight.get(key);
    if (inflight) {
        return inflight;
    }

    if (cached) {
        // Serve stale data immediately, then refresh in background.
        const refreshPromise = loadAndCacheStacks(key, limit, until)
            .catch(() => {
                // Keep stale cache on refresh failures.
            })
            .finally(() => {
                stacksInflight.delete(key);
            });
        stacksInflight.set(key, refreshPromise);
        return cached.value;
    }

    const requestPromise = loadAndCacheStacks(key, limit, until)
        .finally(() => {
            stacksInflight.delete(key);
        });
    stacksInflight.set(key, requestPromise);
    return requestPromise;
}

export {
    fetchAppsByReleases,
    fetchApp,
    fetchLatestReleaseForApp,
    fetchReleasesForApp,
    fetchStack,
    fetchAppsByAuthor,
    fetchStacksByAuthor
};

export function closeServerPool() {
    stacksCache.clear();
    stacksInflight.clear();
    closeServerDb();
}
