import { SimplePool } from 'nostr-tools';
import { PROFILE_RELAYS } from '$lib/config';

const pool = new SimplePool();
const EOSE_GRACE_MS = 300;

const PROFILE_TTL_MS = 30 * 60 * 1000;
const PROFILE_MISS_TTL_MS = 5 * 60 * 1000;

/** @type {Map<string, { event: import('nostr-tools').Event | null, expiresAt: number }>} */
const profileCache = new Map();

function normalizePubkeys(pubkeys) {
    return [...new Set((pubkeys ?? [])
        .map((pk) => String(pk).trim().toLowerCase())
        .filter((pk) => /^[a-f0-9]{64}$/.test(pk)))];
}

function closeSubscription(sub) {
    if (!sub)
        return;
    try {
        sub.close?.();
    }
    catch {
        // noop
    }
    try {
        sub.unsubscribe?.();
    }
    catch {
        // noop
    }
}

function fetchProfilesUntilFirstEose(pubkeys, timeoutMs) {
    return new Promise((resolve) => {
        const events = [];
        const seenIds = new Set();
        let settled = false;
        let sawEose = false;
        let sub = null;
        let eoseGraceTimer = null;
        let timeoutTimer = null;
        const finish = () => {
            if (settled)
                return;
            settled = true;
            if (eoseGraceTimer)
                clearTimeout(eoseGraceTimer);
            if (timeoutTimer)
                clearTimeout(timeoutTimer);
            closeSubscription(sub);
            resolve(events);
        };
        const startEoseGraceWindow = () => {
            if (eoseGraceTimer)
                return;
            eoseGraceTimer = setTimeout(finish, EOSE_GRACE_MS);
        };
        sub = pool.subscribeMany([...PROFILE_RELAYS], [{ kinds: [0], authors: pubkeys, limit: pubkeys.length }], {
            onevent(event) {
                if (!event?.id || seenIds.has(event.id))
                    return;
                seenIds.add(event.id);
                events.push(event);
            },
            oneose() {
                sawEose = true;
                startEoseGraceWindow();
            },
            onclose() {
                if (sawEose) {
                    startEoseGraceWindow();
                    return;
                }
                finish();
            }
        });
        timeoutTimer = setTimeout(finish, timeoutMs);
    });
}

/**
 * Fetch profile events (kind 0) for pubkeys server-side with aggressive in-memory caching.
 * Returns a map: pubkey -> event|null
 */
export async function fetchProfilesServer(pubkeys, options = {}) {
    const { timeout = 5000 } = options;
    const normalized = normalizePubkeys(pubkeys);
    const now = Date.now();
    const results = new Map();
    const missing = [];

    for (const pk of normalized) {
        const cached = profileCache.get(pk);
        if (cached && cached.expiresAt > now) {
            results.set(pk, cached.event);
        }
        else {
            missing.push(pk);
        }
    }

    if (missing.length > 0) {
        let events = [];
        try {
            events = await fetchProfilesUntilFirstEose(missing, timeout);
        }
        catch {
            events = [];
        }

        const latestByPubkey = new Map();
        for (const event of events) {
            if (!event?.pubkey)
                continue;
            const key = event.pubkey.toLowerCase();
            const existing = latestByPubkey.get(key);
            if (!existing || event.created_at > existing.created_at) {
                latestByPubkey.set(key, event);
            }
        }

        for (const pk of missing) {
            const event = latestByPubkey.get(pk) ?? null;
            profileCache.set(pk, {
                event,
                expiresAt: now + (event ? PROFILE_TTL_MS : PROFILE_MISS_TTL_MS)
            });
            results.set(pk, event);
        }
    }

    return results;
}
