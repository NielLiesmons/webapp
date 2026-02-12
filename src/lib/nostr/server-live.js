import { EVENT_KINDS, PROFILE_SERVER_RELAYS, STACK_SERVER_RELAYS } from '$lib/config';
import { parseAppStack, parseProfile } from './models';
import { fetchApp } from './server-db';
import { queryRelays } from './server-relay-pool';
const STACK_LIST_CACHE_TTL_MS = 15_000;
const STACK_DETAIL_CACHE_TTL_MS = 15_000;
const stackListCache = new Map();
const stackDetailCache = new Map();
const inFlightStackList = new Map();
const inFlightStackDetail = new Map();

function sortByCreatedDesc(events) {
    return [...events].sort((a, b) => {
        const byTime = (b.created_at ?? 0) - (a.created_at ?? 0);
        if (byTime !== 0)
            return byTime;
        return (a.id ?? '').localeCompare(b.id ?? '');
    });
}

function dedupeReplaceable(events, keyFn) {
    const deduped = [];
    const seen = new Set();
    for (const event of sortByCreatedDesc(events)) {
        const key = keyFn(event);
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        deduped.push(event);
    }
    return deduped;
}

function getFirstTagValue(event, tagName) {
    const tag = event.tags?.find((item) => item[0] === tagName && typeof item[1] === 'string');
    return tag?.[1] ?? null;
}

async function fetchProfilesByPubkeys(pubkeys) {
    if (pubkeys.length === 0) {
        return { profilesByPubkey: new Map(), profileEvents: [] };
    }
    const events = await queryRelays(PROFILE_SERVER_RELAYS, {
        kinds: [EVENT_KINDS.PROFILE],
        authors: pubkeys,
        limit: Math.max(pubkeys.length * 2, 50)
    });
    const latestProfiles = dedupeReplaceable(events, (event) => event.pubkey);
    const profilesByPubkey = new Map();
    for (const event of latestProfiles) {
        try {
            const parsed = parseProfile(event);
            profilesByPubkey.set(event.pubkey, parsed);
        }
        catch {
            // Skip malformed profile payloads.
        }
    }
    return { profilesByPubkey, profileEvents: latestProfiles };
}

async function resolveAppsForStacks(stacks) {
    const uniqueRefs = new Map();
    for (const stack of stacks) {
        for (const ref of stack.appRefs) {
            if (ref.kind !== EVENT_KINDS.APP)
                continue;
            uniqueRefs.set(`${ref.pubkey}:${ref.identifier}`, ref);
        }
    }
    const appsByRef = new Map();
    const appEvents = [];
    await Promise.all(Array.from(uniqueRefs.values()).map(async (ref) => {
        const app = await fetchApp(ref.pubkey, ref.identifier);
        if (!app)
            return;
        appsByRef.set(`${ref.pubkey}:${ref.identifier}`, app);
        if (app.rawEvent) {
            appEvents.push(app.rawEvent);
        }
    }));
    return { appsByRef, appEvents };
}

function makeResolvedStack(stack, appsByRef, profilesByPubkey) {
    const apps = [];
    for (const ref of stack.appRefs) {
        const app = appsByRef.get(`${ref.pubkey}:${ref.identifier}`);
        if (app)
            apps.push(app);
    }
    const profile = profilesByPubkey.get(stack.pubkey);
    return {
        name: stack.title,
        description: stack.description,
        apps,
        creator: profile
            ? {
                name: profile.displayName || profile.name,
                picture: profile.picture,
                pubkey: stack.pubkey
            }
            : {
                name: undefined,
                picture: undefined,
                pubkey: stack.pubkey
            },
        pubkey: stack.pubkey,
        dTag: stack.dTag
    };
}

export async function fetchStacks(limit = 20, until, options = {}) {
    const authors = Array.isArray(options.authors) ? options.authors.filter(Boolean) : [];
    const cacheKey = JSON.stringify({ limit, until: until ?? null, authors });
    const cached = stackListCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }
    const existing = inFlightStackList.get(cacheKey);
    if (existing) {
        return existing;
    }
    const task = (async () => {
        const result = await fetchStacksUncached(limit, until, authors);
        stackListCache.set(cacheKey, { value: result, expiresAt: Date.now() + STACK_LIST_CACHE_TTL_MS });
        return result;
    })();
    inFlightStackList.set(cacheKey, task);
    try {
        return await task;
    }
    finally {
        inFlightStackList.delete(cacheKey);
    }
}
async function fetchStacksUncached(limit, until, authors) {
    const filter = {
        kinds: [EVENT_KINDS.APP_STACK],
        limit: Math.max(limit * 3, limit)
    };
    if (authors.length > 0) {
        filter.authors = authors;
    }
    if (until !== undefined) {
        filter.until = until;
    }
    const relayEvents = await queryRelays(STACK_SERVER_RELAYS, filter);
    const deduped = dedupeReplaceable(relayEvents, (event) => {
        const dTag = getFirstTagValue(event, 'd');
        if (!dTag)
            return null;
        return `${event.pubkey}:${dTag}`;
    }).slice(0, limit);
    const stacks = deduped.map(parseAppStack);
    const { appsByRef, appEvents } = await resolveAppsForStacks(stacks);
    const creatorPubkeys = Array.from(new Set(stacks.map((stack) => stack.pubkey).filter(Boolean)));
    const { profilesByPubkey, profileEvents } = await fetchProfilesByPubkeys(creatorPubkeys);
    const resolvedStacks = stacks.map((stack) => makeResolvedStack(stack, appsByRef, profilesByPubkey));
    const last = deduped[deduped.length - 1];
    const nextCursor = deduped.length === limit && last ? last.created_at - 1 : null;
    return {
        stacks,
        resolvedStacks,
        nextCursor,
        seedEvents: [...deduped, ...appEvents, ...profileEvents]
    };
}

export async function fetchStack(pubkey, identifier) {
    const cacheKey = `${pubkey}:${identifier}`;
    const cached = stackDetailCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }
    const existing = inFlightStackDetail.get(cacheKey);
    if (existing) {
        return existing;
    }
    const task = (async () => {
        const result = await fetchStackUncached(pubkey, identifier);
        stackDetailCache.set(cacheKey, { value: result, expiresAt: Date.now() + STACK_DETAIL_CACHE_TTL_MS });
        return result;
    })();
    inFlightStackDetail.set(cacheKey, task);
    try {
        return await task;
    }
    finally {
        inFlightStackDetail.delete(cacheKey);
    }
}
async function fetchStackUncached(pubkey, identifier) {
    const events = await queryRelays(STACK_SERVER_RELAYS, {
        kinds: [EVENT_KINDS.APP_STACK],
        authors: [pubkey],
        '#d': [identifier],
        limit: 30
    });
    const candidates = dedupeReplaceable(events, (event) => {
        const dTag = getFirstTagValue(event, 'd');
        if (!dTag)
            return null;
        return `${event.pubkey}:${dTag}`;
    });
    const event = candidates.find((item) => {
        const dTag = getFirstTagValue(item, 'd');
        return item.pubkey === pubkey && dTag === identifier;
    });
    if (!event) {
        return null;
    }
    const stack = parseAppStack(event);
    const { appsByRef, appEvents } = await resolveAppsForStacks([stack]);
    const apps = [];
    for (const ref of stack.appRefs) {
        const app = appsByRef.get(`${ref.pubkey}:${ref.identifier}`);
        if (app)
            apps.push(app);
    }
    const { profilesByPubkey, profileEvents } = await fetchProfilesByPubkeys([stack.pubkey]);
    const profile = profilesByPubkey.get(stack.pubkey);
    const creator = profile
        ? {
            name: profile.displayName || profile.name,
            picture: profile.picture,
            pubkey: stack.pubkey
        }
        : {
            name: undefined,
            picture: undefined,
            pubkey: stack.pubkey
        };
    return {
        stack,
        apps,
        creator,
        seedEvents: [event, ...appEvents, ...profileEvents]
    };
}
