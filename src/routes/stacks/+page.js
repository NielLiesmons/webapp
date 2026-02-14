/**
 * Stacks listing page — universal load
 *
 * SSR: fetches seed events from the server's in-memory relay cache for instant first paint.
 * Client-side navigation: returns empty — Dexie (IndexedDB) + liveQuery handle everything.
 * Offline: no server round-trip needed, page renders from local data.
 */
import { browser } from '$app/environment';

export const prerender = false;

/** Above-the-fold: grid shows ~6 stacks, plus scroll buffer */
const SEED_STACKS_LIMIT = 12;

export const load = async () => {
	// Client-side: Dexie + relay subscriptions are active, no seed data needed
	if (browser) return { seedEvents: [] };

	// SSR: fetch seed data from server cache
	const { fetchStacks } = await import('$lib/nostr/server.js');
	const seedEvents = fetchStacks(SEED_STACKS_LIMIT);
	return { seedEvents };
};
