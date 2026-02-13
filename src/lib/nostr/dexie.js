/**
 * Dexie Database — Client-side reactive data layer
 *
 * Single source of truth on the client. All Nostr events are stored here.
 * Use liveQuery() from 'dexie' for reactive subscriptions that auto-update
 * when underlying data changes.
 *
 * Schema: events are stored as raw Nostr events (id, pubkey, created_at, kind, tags, content, sig).
 */
import Dexie from 'dexie';
import { EVENT_KINDS } from '$lib/config';

export const db = new Dexie('zapstore');

db.version(1).stores({
	// Primary key: id
	// Indices: kind, pubkey, created_at, compound [kind+created_at], compound [kind+pubkey]
	events: 'id, kind, pubkey, created_at, [kind+created_at], [kind+pubkey]'
});

/**
 * Check if a Nostr event matches a NIP-01 filter (tag filters only — kind/authors/ids
 * are assumed to be handled by Dexie index queries for performance).
 */
function matchesTags(event, filter) {
	for (const [key, values] of Object.entries(filter)) {
		if (!key.startsWith('#') || !Array.isArray(values) || values.length === 0) continue;
		const tagName = key.slice(1);
		const valueSet = new Set(values);
		const hasMatch = event.tags?.some((t) => t[0] === tagName && t[1] && valueSet.has(t[1]));
		if (!hasMatch) return false;
	}
	return true;
}

/**
 * Write events to Dexie. Deduplicates by id.
 * For replaceable events (kind >= 10000 or kind >= 30000), keeps only the latest
 * by (kind, pubkey, dTag).
 *
 * @param {import('nostr-tools').Event[]} events
 */
export async function putEvents(events) {
	if (!events || events.length === 0) return;

	const valid = events.filter(
		(e) => e?.id && typeof e.kind === 'number'
			// Discard encrypted app stacks (non-empty content means encrypted)
			&& !(e.kind === EVENT_KINDS.APP_STACK && e.content)
	);
	if (valid.length === 0) return;

	// Separate replaceable and non-replaceable
	const nonReplaceable = [];
	const replaceableByKey = new Map();

	for (const event of valid) {
		const isReplaceable =
			(event.kind >= 10000 && event.kind < 20000) || event.kind >= 30000;

		if (isReplaceable) {
			const dTag = event.tags?.find((t) => t[0] === 'd')?.[1] ?? '';
			const key = `${event.kind}:${event.pubkey}:${dTag}`;
			const existing = replaceableByKey.get(key);
			if (!existing || event.created_at > existing.created_at) {
				replaceableByKey.set(key, event);
			}
		} else {
			nonReplaceable.push(event);
		}
	}

	const toPut = [...nonReplaceable, ...replaceableByKey.values()];

	// For replaceable events, remove older versions before inserting
	// Single batch query for all (kind, pubkey) pairs, then filter in memory
	await db.transaction('rw', db.events, async () => {
		if (replaceableByKey.size > 0) {
			// Collect unique (kind, pubkey) pairs
			const kindPubkeyPairs = new Map();
			for (const event of replaceableByKey.values()) {
				const kp = `${event.kind}:${event.pubkey}`;
				if (!kindPubkeyPairs.has(kp)) {
					kindPubkeyPairs.set(kp, [event.kind, event.pubkey]);
				}
			}

			// Single batch query for all candidates
			const existingEvents = await db.events
				.where('[kind+pubkey]')
				.anyOf([...kindPubkeyPairs.values()])
				.toArray();

			// Find IDs to delete: events that match a replaceable key but are not the new version
			const newEventIds = new Set([...replaceableByKey.values()].map((e) => e.id));
			const idsToDelete = [];
			for (const existing of existingEvents) {
				const dTag = existing.tags?.find((t) => t[0] === 'd')?.[1] ?? '';
				const key = `${existing.kind}:${existing.pubkey}:${dTag}`;
				if (replaceableByKey.has(key) && !newEventIds.has(existing.id)) {
					idsToDelete.push(existing.id);
				}
			}

			if (idsToDelete.length > 0) {
				await db.events.bulkDelete(idsToDelete);
			}
		}
		await db.events.bulkPut(toPut);
	});
}

/**
 * Query events from Dexie using a Nostr-style filter.
 * Uses indices for kind/pubkey, then filters tags in memory.
 *
 * @param {object} filter - NIP-01 filter
 * @returns {Promise<import('nostr-tools').Event[]>}
 */
export async function queryEvents(filter) {
	let collection;

	// Start with the most selective index
	if (filter.kinds?.length === 1 && filter.authors?.length === 1) {
		collection = db.events.where('[kind+pubkey]').equals([filter.kinds[0], filter.authors[0]]);
	} else if (filter.kinds?.length === 1) {
		collection = db.events.where('kind').equals(filter.kinds[0]);
	} else if (filter.ids?.length > 0) {
		collection = db.events.where('id').anyOf(filter.ids);
	} else {
		collection = db.events.toCollection();
	}

	let results = await collection.toArray();

	// Apply remaining filters
	if (filter.kinds && filter.kinds.length > 1) {
		const kindSet = new Set(filter.kinds);
		results = results.filter((e) => kindSet.has(e.kind));
	}
	if (filter.authors && filter.authors.length > 0 && !(filter.kinds?.length === 1 && filter.authors.length === 1)) {
		const authorSet = new Set(filter.authors);
		results = results.filter((e) => authorSet.has(e.pubkey));
	}
	if (filter.since !== undefined) {
		results = results.filter((e) => e.created_at >= filter.since);
	}
	if (filter.until !== undefined) {
		results = results.filter((e) => e.created_at <= filter.until);
	}

	// Tag filters
	results = results.filter((e) => matchesTags(e, filter));

	// Sort by created_at descending
	results.sort((a, b) => b.created_at - a.created_at);

	// Apply limit
	if (filter.limit && filter.limit > 0) {
		results = results.slice(0, filter.limit);
	}

	return results;
}

/**
 * Query a single event from Dexie.
 *
 * @param {object} filter - NIP-01 filter
 * @returns {Promise<import('nostr-tools').Event | null>}
 */
export async function queryEvent(filter) {
	const results = await queryEvents({ ...filter, limit: 1 });
	return results[0] ?? null;
}

// Re-export liveQuery for convenience
export { liveQuery } from 'dexie';
