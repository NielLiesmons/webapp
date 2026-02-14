/**
 * Stacks listing page — universal load
 *
 * SSR: fetches seed events from the server's in-memory relay cache for instant first paint.
 * Client-side navigation: returns empty — Dexie (IndexedDB) + liveQuery handle everything.
 * Offline: no server round-trip needed, page renders from local data.
 */
import { browser } from '$app/environment';
import { STACKS_PAGE_SIZE } from '$lib/constants';

export const prerender = false;

export const load = async () => {
	// Client-side: Dexie + relay subscriptions are active, no seed data needed
	if (browser) return { seedEvents: [] };

	// SSR: fetch seed data from server cache
	const { fetchStacks } = await import('$lib/nostr/server.js');
	const seedEvents = fetchStacks(STACKS_PAGE_SIZE);
	return { seedEvents };
};
