import { json } from '@sveltejs/kit';
import { fetchStack } from '$lib/nostr/server';

export async function GET({ url }) {
    const pubkey = url.searchParams.get('pubkey')?.trim() ?? '';
    const identifier = url.searchParams.get('identifier')?.trim() ?? '';
    if (!pubkey || !identifier) {
        return json({ apps: [] }, { status: 400 });
    }
    const result = await fetchStack(pubkey, identifier);
    return json({ apps: result?.apps ?? [] });
}
