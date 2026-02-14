/**
 * Discover page — universal load
 *
 * SSR: fetches seed events from the server's in-memory relay cache for instant first paint.
 *      Apps are sorted by latest release date (server-side ranking).
 *      Both app events (32267) and their latest releases (30063) are included
 *      so the client can do release-ordered display via liveQuery.
 *
 * Client-side navigation: returns empty — Dexie (IndexedDB) + liveQuery handle everything.
 * Offline: no server round-trip needed, page renders from local data.
 */
import { browser } from '$app/environment';
import { APPS_PAGE_SIZE, STACKS_PAGE_SIZE } from '$lib/constants';

export const prerender = false;

export const load = async () => {
	// Client-side: Dexie + relay subscriptions are active, no seed data needed
	if (browser) return { seedEvents: [], appsCursor: null, appsHasMore: true };

	// SSR: fetch seed data from server cache
	const { fetchAppsSortedByRelease, fetchStacks } = await import('$lib/nostr/server.js');
	const { events: appEvents, cursor, hasMore } = fetchAppsSortedByRelease(APPS_PAGE_SIZE);
	const stackEvents = fetchStacks(STACKS_PAGE_SIZE);

	// Deduplicate: stacks seed includes referenced app events that may overlap with app seed
	const seen = new Set();
	const seedEvents = [];
	for (const event of [...appEvents, ...stackEvents]) {
		if (!seen.has(event.id)) {
			seen.add(event.id);
			seedEvents.push(event);
		}
	}

	return { seedEvents, appsCursor: cursor, appsHasMore: hasMore };
};
