/**
 * App detail page — server-side seed data
 *
 * Returns app metadata from the polling cache.
 * No releases on server — client fetches them from relays.
 */
import { decodeNaddr } from '$lib/nostr';
import { fetchApp } from '$lib/nostr/server';

export const prerender = false;

export const load = async ({ params }) => {
	const pointer = decodeNaddr(params.naddr);
	if (!pointer) {
		return {
			app: null,
			error: 'Invalid app URL',
			seedEvents: []
		};
	}
	const { pubkey, identifier } = pointer;
	const result = fetchApp(pubkey, identifier);
	if (!result) {
		return {
			app: null,
			error: 'App not found',
			seedEvents: []
		};
	}
	return {
		app: result.app,
		error: null,
		seedEvents: result.seedEvents
	};
};
