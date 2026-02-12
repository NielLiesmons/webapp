import { nip19 } from 'nostr-tools';
import { decodeNaddr } from '$lib/nostr';
import { fetchStack } from '$lib/nostr/server';

export const prerender = false;

export const load = async ({ params }) => {
    const pointer = decodeNaddr(params.naddr);
    if (!pointer) {
        return {
            stack: null,
            apps: [],
            error: 'Invalid stack URL',
            seedEvents: []
        };
    }
    const { pubkey, identifier } = pointer;
    const result = await fetchStack(pubkey, identifier);
    if (!result) {
        return {
            stack: null,
            apps: [],
            error: 'Stack not found',
            seedEvents: []
        };
    }
    const creator = result.creator
        ? {
            ...result.creator,
            npub: result.creator.pubkey ? nip19.npubEncode(result.creator.pubkey) : undefined
        }
        : null;
    return {
        stack: {
            ...result.stack,
            creator
        },
        apps: result.apps,
        error: null,
        seedEvents: result.seedEvents
    };
};
