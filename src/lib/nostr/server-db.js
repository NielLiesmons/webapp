import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { EVENT_KINDS, PLATFORM_FILTER } from '$lib/config';
import { parseApp, parseAppStack, parseProfile, parseRelease } from './models';
let db = null;
function dynamicImport(moduleName) {
    // Keep module resolution runtime-only so Node build does not try to load bun:* modules.
    const importer = new Function('m', 'return import(m)');
    return importer(moduleName);
}
function getDbPath() {
    const configured = process.env.CATALOG_DB_PATH?.trim();
    const candidate = configured && configured.length > 0 ? configured : 'relay.db';
    const absolute = resolve(process.cwd(), candidate);
    if (!existsSync(absolute)) {
        throw new Error(`[ServerDB] SQLite file not found at "${absolute}". Set CATALOG_DB_PATH or place relay.db at project root.`);
    }
    return absolute;
}
async function getDb() {
    if (db)
        return db;
    const dbPath = getDbPath();
    // Bun runtime: use bun:sqlite (requested).
    if (typeof globalThis.Bun !== 'undefined') {
        const bunModule = (await dynamicImport('bun:sqlite'));
        db = new bunModule.Database(dbPath, { readonly: true, create: false });
        return db;
    }
    // Node runtime (SvelteKit build/prerender path): use native node:sqlite.
    const nodeSqlite = (await dynamicImport('node:sqlite'));
    const nativeDb = new nodeSqlite.DatabaseSync(dbPath, { readOnly: true });
    db = {
        query(sql) {
            const statement = nativeDb.prepare(sql);
            return {
                all: (...params) => statement.all(...params),
                get: (...params) => statement.get(...params) ?? null
            };
        },
        close() {
            nativeDb.close();
        }
    };
    return db;
}
function parseTags(rawTags) {
    try {
        const parsed = JSON.parse(rawTags);
        if (!Array.isArray(parsed))
            return [];
        return parsed
            .filter((tag) => Array.isArray(tag))
            .map((tag) => tag.map((item) => String(item)));
    }
    catch {
        return [];
    }
}
function rowToEvent(row) {
    return {
        id: row.id,
        pubkey: row.pubkey,
        created_at: row.created_at,
        kind: row.kind,
        tags: parseTags(row.tags),
        content: row.content,
        sig: row.sig
    };
}
function getFirstTagValue(event, tagName) {
    const tag = event.tags.find((t) => t[0] === tagName && typeof t[1] === 'string');
    return tag?.[1] ?? null;
}
function getReleaseIdentifier(event) {
    const iTag = getFirstTagValue(event, 'i');
    if (iTag)
        return iTag;
    // Fallback for releases that only carry d like "com.app.id@1.2.3".
    const dTag = getFirstTagValue(event, 'd');
    if (!dTag)
        return null;
    const [identifier] = dTag.split('@');
    return identifier || null;
}
function dedupeEventsById(events) {
    const seen = new Set();
    const result = [];
    for (const event of events) {
        if (seen.has(event.id))
            continue;
        seen.add(event.id);
        result.push(event);
    }
    return result;
}
function buildInPlaceholders(count) {
    return new Array(count).fill('?').join(',');
}

function getLatestAppsForRefs(database, refs) {
    if (!refs || refs.length === 0)
        return [];
    const platformTag = PLATFORM_FILTER['#f']?.[0];
    const byPubkey = new Map();
    for (const ref of refs) {
        if (!ref?.pubkey || !ref?.identifier)
            continue;
        const existing = byPubkey.get(ref.pubkey) || [];
        existing.push(ref.identifier);
        byPubkey.set(ref.pubkey, existing);
    }
    const appEvents = [];
    for (const [pubkey, identifiers] of byPubkey.entries()) {
        const uniqueIdentifiers = Array.from(new Set(identifiers));
        const inClause = buildInPlaceholders(uniqueIdentifiers.length);
        const sql = `SELECT e.id, e.pubkey, e.created_at, e.kind, json(e.tags) AS tags, e.content, e.sig
			FROM events e
			INNER JOIN tags d ON d.event_id = e.id AND d.key = 'd'
			WHERE e.kind = ?
			  AND e.pubkey = ?
			  AND d.value IN (${inClause})
			  ${platformTag ? `AND EXISTS (
					SELECT 1 FROM tags f
					WHERE f.event_id = e.id
					  AND f.key = 'f'
					  AND f.value = ?
			  )` : ''}
			ORDER BY e.created_at DESC, e.id ASC`;
        const params = [EVENT_KINDS.APP, pubkey, ...uniqueIdentifiers];
        if (platformTag)
            params.push(platformTag);
        const rows = database.query(sql).all(...params);
        appEvents.push(...rows.map(rowToEvent));
    }
    const latestByKey = new Map();
    for (const ev of appEvents) {
        const dTag = getFirstTagValue(ev, 'd');
        if (!dTag)
            continue;
        const key = `${ev.pubkey}:${dTag}`;
        if (!latestByKey.has(key)) {
            latestByKey.set(key, ev);
        }
    }
    const ordered = [];
    for (const ref of refs) {
        const ev = latestByKey.get(`${ref.pubkey}:${ref.identifier}`);
        if (ev)
            ordered.push(ev);
    }
    return ordered;
}
export async function fetchAppsByReleases(limit = 20, until) {
    const database = await getDb();
    const releaseQuery = until === undefined
        ? database.query(`SELECT id, pubkey, created_at, kind, json(tags) AS tags, content, sig
				 FROM events
				 WHERE kind = ?
				 ORDER BY created_at DESC, id ASC
				 LIMIT ?`)
        : database.query(`SELECT id, pubkey, created_at, kind, json(tags) AS tags, content, sig
				 FROM events
				 WHERE kind = ?
				   AND created_at <= ?
				 ORDER BY created_at DESC, id ASC
				 LIMIT ?`);
    const releaseRows = until === undefined
        ? releaseQuery.all(EVENT_KINDS.RELEASE, limit)
        : releaseQuery.all(EVENT_KINDS.RELEASE, until, limit);
    const releaseEvents = releaseRows.map(rowToEvent);
    if (releaseEvents.length === 0) {
        return { apps: [], releases: [], nextCursor: null, seedEvents: [] };
    }
    const releaseRefs = releaseEvents.map((event) => ({
        release: event,
        identifier: getReleaseIdentifier(event)
    }));
    const identifiers = Array.from(new Set(releaseRefs.map((ref) => ref.identifier).filter((id) => Boolean(id))));
    const platformTag = PLATFORM_FILTER['#f']?.[0];
    let appEvents = [];
    if (identifiers.length > 0) {
        const inClause = buildInPlaceholders(identifiers.length);
        const sql = `SELECT e.id, e.pubkey, e.created_at, e.kind, json(e.tags) AS tags, e.content, e.sig, d.value AS d_tag
			FROM events e
			INNER JOIN tags d ON d.event_id = e.id AND d.key = 'd'
			WHERE e.kind = ?
			  AND d.value IN (${inClause})
			  ${platformTag ? `AND EXISTS (
					SELECT 1 FROM tags f
					WHERE f.event_id = e.id
					  AND f.key = 'f'
					  AND f.value = ?
			  )` : ''}
			ORDER BY e.created_at DESC, e.id ASC`;
        const params = [EVENT_KINDS.APP, ...identifiers];
        if (platformTag)
            params.push(platformTag);
        const appRows = database.query(sql).all(...params);
        appEvents = appRows.map(rowToEvent);
    }
    // Latest replaceable app event for (pubkey, d) and for d fallback.
    const latestByPubkeyAndD = new Map();
    const latestByDOnly = new Map();
    for (const appEvent of appEvents) {
        const dTag = getFirstTagValue(appEvent, 'd');
        if (!dTag)
            continue;
        const key = `${appEvent.pubkey}:${dTag}`;
        if (!latestByPubkeyAndD.has(key)) {
            latestByPubkeyAndD.set(key, appEvent);
        }
        if (!latestByDOnly.has(dTag)) {
            latestByDOnly.set(dTag, appEvent);
        }
    }
    const apps = [];
    const selectedAppEvents = [];
    const seenAppKeys = new Set();
    for (const { release, identifier } of releaseRefs) {
        if (!identifier)
            continue;
        const exactKey = `${release.pubkey}:${identifier}`;
        const appEvent = latestByPubkeyAndD.get(exactKey) ?? latestByDOnly.get(identifier);
        if (!appEvent)
            continue;
        const appKey = `${appEvent.pubkey}:${identifier}`;
        if (seenAppKeys.has(appKey))
            continue;
        seenAppKeys.add(appKey);
        apps.push(parseApp(appEvent));
        selectedAppEvents.push(appEvent);
    }
    const releases = releaseEvents.map(parseRelease);
    const lastRelease = releaseEvents[releaseEvents.length - 1];
    const nextCursor = releaseEvents.length === limit && lastRelease ? lastRelease.created_at - 1 : null;
    const seedEvents = dedupeEventsById([...releaseEvents, ...selectedAppEvents]);
    return { apps, releases, nextCursor, seedEvents };
}
export async function fetchApp(pubkey, identifier) {
    const database = await getDb();
    const platformTag = PLATFORM_FILTER['#f']?.[0];
    const query = database.query(`SELECT e.id, e.pubkey, e.created_at, e.kind, json(e.tags) AS tags, e.content, e.sig
		 FROM events e
		 INNER JOIN tags d ON d.event_id = e.id AND d.key = 'd'
		 WHERE e.kind = ?
		   AND e.pubkey = ?
		   AND d.value = ?
		   ${platformTag ? `AND EXISTS (
				SELECT 1 FROM tags f
				WHERE f.event_id = e.id
				  AND f.key = 'f'
				  AND f.value = ?
		   )` : ''}
		 ORDER BY e.created_at DESC, e.id ASC
		 LIMIT 1`);
    const row = platformTag
        ? query.get(EVENT_KINDS.APP, pubkey, identifier, platformTag)
        : query.get(EVENT_KINDS.APP, pubkey, identifier);
    if (!row)
        return null;
    return parseApp(rowToEvent(row));
}
export async function fetchLatestReleaseForApp(pubkey, identifier) {
    const database = await getDb();
    const query = database.query(`SELECT e.id, e.pubkey, e.created_at, e.kind, json(e.tags) AS tags, e.content, e.sig
		 FROM events e
		 WHERE e.kind = ?
		   AND e.pubkey = ?
		   AND (
			 EXISTS (
				SELECT 1 FROM tags i
				WHERE i.event_id = e.id
				  AND i.key = 'i'
				  AND i.value = ?
			 )
			 OR EXISTS (
				SELECT 1 FROM tags d
				WHERE d.event_id = e.id
				  AND d.key = 'd'
				  AND d.value LIKE ?
			 )
		   )
		 ORDER BY e.created_at DESC, e.id ASC
		 LIMIT 1`);
    const row = query.get(EVENT_KINDS.RELEASE, pubkey, identifier, `${identifier}@%`);
    if (!row)
        return null;
    return parseRelease(rowToEvent(row));
}

export async function fetchReleasesForApp(pubkey, identifier, limit = 50) {
    const database = await getDb();
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const aTagValue = `${EVENT_KINDS.APP}:${pubkey}:${identifier}`;
    const platformTag = PLATFORM_FILTER['#f']?.[0];
    const sql = `SELECT e.id, e.pubkey, e.created_at, e.kind, json(e.tags) AS tags, e.content, e.sig
		 FROM events e
		 INNER JOIN tags a ON a.event_id = e.id AND a.key = 'a'
		 WHERE e.kind = ?
		   AND a.value = ?
		   ${platformTag ? `AND EXISTS (
				SELECT 1 FROM tags f
				WHERE f.event_id = e.id
				  AND f.key = 'f'
				  AND f.value = ?
		   )` : ''}
		 ORDER BY e.created_at DESC, e.id ASC
		 LIMIT ?`;
    const params = platformTag
        ? [EVENT_KINDS.RELEASE, aTagValue, platformTag, safeLimit]
        : [EVENT_KINDS.RELEASE, aTagValue, safeLimit];
    const rows = database.query(sql).all(...params);
    return rows.map((row) => parseRelease(rowToEvent(row)));
}

export async function fetchStacks(limit = 20, until) {
    const database = await getDb();
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const stackQuery = until === undefined
        ? database.query(`SELECT id, pubkey, created_at, kind, json(tags) AS tags, content, sig
				 FROM events
				 WHERE kind = ?
				 ORDER BY created_at DESC, id ASC
				 LIMIT ?`)
        : database.query(`SELECT id, pubkey, created_at, kind, json(tags) AS tags, content, sig
				 FROM events
				 WHERE kind = ?
				   AND created_at <= ?
				 ORDER BY created_at DESC, id ASC
				 LIMIT ?`);
    const rows = until === undefined
        ? stackQuery.all(EVENT_KINDS.APP_STACK, safeLimit)
        : stackQuery.all(EVENT_KINDS.APP_STACK, until, safeLimit);
    const stackEvents = rows.map(rowToEvent);
    const stacks = stackEvents.map(parseAppStack);
    const resolvedStacks = [];
    const selectedAppEvents = [];
    for (const stack of stacks) {
        const appEvents = getLatestAppsForRefs(database, stack.appRefs ?? []);
        selectedAppEvents.push(...appEvents);
        resolvedStacks.push({
            stack,
            apps: appEvents.map(parseApp)
        });
    }
    const lastStack = stackEvents[stackEvents.length - 1];
    const nextCursor = stackEvents.length === safeLimit && lastStack ? lastStack.created_at - 1 : null;
    const seedEvents = dedupeEventsById([...stackEvents, ...selectedAppEvents]);
    return {
        stacks,
        resolvedStacks,
        nextCursor,
        seedEvents
    };
}

export async function fetchStack(pubkey, identifier) {
    const database = await getDb();
    const stackQuery = database.query(`SELECT e.id, e.pubkey, e.created_at, e.kind, json(e.tags) AS tags, e.content, e.sig
		 FROM events e
		 INNER JOIN tags d ON d.event_id = e.id AND d.key = 'd'
		 WHERE e.kind = ?
		   AND e.pubkey = ?
		   AND d.value = ?
		 ORDER BY e.created_at DESC, e.id ASC
		 LIMIT 1`);
    const stackRow = stackQuery.get(EVENT_KINDS.APP_STACK, pubkey, identifier);
    if (!stackRow)
        return null;
    const stackEvent = rowToEvent(stackRow);
    const stack = parseAppStack(stackEvent);
    const appEvents = getLatestAppsForRefs(database, stack.appRefs ?? []);
    const apps = appEvents.map(parseApp);
    const profileQuery = database.query(`SELECT e.id, e.pubkey, e.created_at, e.kind, json(e.tags) AS tags, e.content, e.sig
		 FROM events e
		 WHERE e.kind = ?
		   AND e.pubkey = ?
		 ORDER BY e.created_at DESC, e.id ASC
		 LIMIT 1`);
    const profileRow = profileQuery.get(EVENT_KINDS.PROFILE, pubkey);
    const creator = profileRow ? parseProfile(rowToEvent(profileRow)) : null;
    const seedEvents = dedupeEventsById([stackEvent, ...appEvents, ...(profileRow ? [rowToEvent(profileRow)] : [])]);
    return {
        stack,
        apps,
        creator,
        seedEvents
    };
}

export async function fetchAppsByAuthor(pubkey, limit = 50) {
    const database = await getDb();
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const platformTag = PLATFORM_FILTER['#f']?.[0];
    const sql = `SELECT e.id, e.pubkey, e.created_at, e.kind, json(e.tags) AS tags, e.content, e.sig
		 FROM events e
		 WHERE e.kind = ?
		   AND e.pubkey = ?
		   ${platformTag ? `AND EXISTS (
				SELECT 1 FROM tags f
				WHERE f.event_id = e.id
				  AND f.key = 'f'
				  AND f.value = ?
		   )` : ''}
		 ORDER BY e.created_at DESC, e.id ASC
		 LIMIT ?`;
    const params = platformTag
        ? [EVENT_KINDS.APP, pubkey, platformTag, safeLimit]
        : [EVENT_KINDS.APP, pubkey, safeLimit];
    const rows = database.query(sql).all(...params);
    return rows.map((row) => parseApp(rowToEvent(row)));
}

export async function fetchStacksByAuthor(pubkey, limit = 50) {
    const database = await getDb();
    const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
    const sql = `SELECT e.id, e.pubkey, e.created_at, e.kind, json(e.tags) AS tags, e.content, e.sig
		 FROM events e
		 WHERE e.kind = ?
		   AND e.pubkey = ?
		 ORDER BY e.created_at DESC, e.id ASC
		 LIMIT ?`;
    const rows = database.query(sql).all(EVENT_KINDS.APP_STACK, pubkey, safeLimit);
    const stackEvents = rows.map(rowToEvent);
    const stacks = stackEvents.map(parseAppStack);
    const resolvedStacks = [];
    for (const stack of stacks) {
        const appEvents = getLatestAppsForRefs(database, stack.appRefs ?? []);
        resolvedStacks.push({
            stack,
            apps: appEvents.map(parseApp)
        });
    }
    return {
        stacks,
        resolvedStacks
    };
}
export function closeServerDb() {
    if (db) {
        db.close();
        db = null;
    }
}
