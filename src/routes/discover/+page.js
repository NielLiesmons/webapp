/**
 * Discover page — universal load
 *
 * SSR: fetches seed events from the server's in-memory relay cache for instant first paint.
 * Client-side navigation: returns empty — Dexie (IndexedDB) + liveQuery handle everything.
 * Offline: no server round-trip needed, page renders from local data.
 */
import { browser } from '$app/environment';

export const prerender = false;

/** Above-the-fold limits: ~4 columns × 4 rows of apps, ~4 visible stacks */
const SEED_APPS_LIMIT = 24;
const SEED_STACKS_LIMIT = 8;

export const load = async () => {
	// Client-side: Dexie + relay subscriptions are active, no seed data needed
	if (browser) return { seedEvents: [] };

	// SSR: fetch seed data from server cache
	const { fetchApps, fetchStacks } = await import('$lib/nostr/server.js');
	const appEvents = fetchApps(SEED_APPS_LIMIT);
	const stackEvents = fetchStacks(SEED_STACKS_LIMIT);

	// Deduplicate: stacks seed includes referenced app events that may overlap with app seed
	const seen = new Set();
	const seedEvents = [];
	for (const event of [...appEvents, ...stackEvents]) {
		if (!seen.has(event.id)) {
			seen.add(event.id);
			seedEvents.push(event);
		}
	}

	return { seedEvents };
};
