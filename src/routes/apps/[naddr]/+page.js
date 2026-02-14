/**
 * App detail page — universal load
 *
 * SSR: fetches app metadata from the server's in-memory relay cache.
 * Client-side navigation: returns empty — component queries Dexie directly.
 * Offline: no server round-trip needed, component loads from IndexedDB.
 */
import { browser } from '$app/environment';
import { decodeNaddr } from '$lib/nostr';

export const prerender = false;

export const load = async ({ params }) => {
	// Client-side: component queries Dexie for app data, no server seed needed
	if (browser) return { app: null, error: null, seedEvents: [] };

	// SSR: fetch from server cache
	const { fetchApp } = await import('$lib/nostr/server.js');

	const pointer = decodeNaddr(params.naddr);
	if (!pointer) {
		return { app: null, error: 'Invalid app URL', seedEvents: [] };
	}

	const { pubkey, identifier } = pointer;
	const result = fetchApp(pubkey, identifier);
	if (!result) {
		return { app: null, error: 'App not found', seedEvents: [] };
	}

	return {
		app: result.app,
		error: null,
		seedEvents: result.seedEvents
	};
};
