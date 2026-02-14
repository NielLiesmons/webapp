/**
 * Apps listing page — universal load
 *
 * SSR: fetches seed events from the server's in-memory relay cache for instant first paint.
 * Client-side navigation: returns empty — Dexie (IndexedDB) + liveQuery handle everything.
 * Offline: no server round-trip needed, page renders from local data.
 */
import { browser } from '$app/environment';

export const prerender = false;

/** Above-the-fold: 3-column grid × ~3 rows ≈ 9, plus scroll buffer */
const SEED_APPS_LIMIT = 24;

export const load = async () => {
	// Client-side: Dexie + relay subscriptions are active, no seed data needed
	if (browser) return { seedEvents: [] };

	// SSR: fetch seed data from server cache
	const { fetchApps } = await import('$lib/nostr/server.js');
	const seedEvents = fetchApps(SEED_APPS_LIMIT);
	return { seedEvents };
};
