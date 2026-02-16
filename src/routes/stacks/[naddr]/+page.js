/**
 * Stack detail page — universal load
 *
 * SSR: fetches stack + apps + creator from the server's in-memory relay cache.
 * Client-side navigation: returns empty — component queries Dexie directly.
 * Offline: no server round-trip needed, component loads from IndexedDB.
 */
import { browser } from '$app/environment';
import { decodeNaddr } from '$lib/nostr';

export const prerender = false;

export const load = async ({ params }) => {
	// Client-side: component queries Dexie for stack data
	if (browser) return { stack: null, apps: [], error: null, seedEvents: [] };

	// SSR: fetch from server cache
	const { nip19 } = await import('nostr-tools');
	const { fetchStack } = await import('$lib/nostr/server.js');

	const pointer = decodeNaddr(params.naddr);
	if (!pointer) {
		return { stack: null, apps: [], error: 'Invalid stack URL', seedEvents: [] };
	}

	const { pubkey, identifier } = pointer;
	const result = fetchStack(pubkey, identifier);
	if (!result) {
		return { stack: null, apps: [], error: 'Stack not found', seedEvents: [] };
	}

	const creator = result.creator
		? {
				...result.creator,
				npub: result.creator.pubkey ? nip19.npubEncode(result.creator.pubkey) : undefined
			}
		: null;

	return {
		stack: { ...result.stack, creator },
		apps: result.apps,
		error: null,
		seedEvents: result.seedEvents
	};
};
