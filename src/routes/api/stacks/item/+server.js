import { json } from '@sveltejs/kit';
import { decodeNaddr } from '$lib/nostr';
import { fetchStack } from '$lib/nostr/server';

export async function GET({ url }) {
    const naddr = url.searchParams.get('naddr')?.trim() ?? '';
    const pointer = decodeNaddr(naddr);
    if (!pointer) {
        return json({ stack: null, apps: [], error: 'Invalid stack URL' }, { status: 400 });
    }
    const result = await fetchStack(pointer.pubkey, pointer.identifier);
    if (!result) {
        return json({ stack: null, apps: [], error: 'Stack not found' }, { status: 404 });
    }
    return json({
        stack: {
            ...result.stack,
            creator: result.creator
        },
        apps: result.apps,
        error: null
    });
}
