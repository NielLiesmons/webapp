import { json } from '@sveltejs/kit';
import { decodeNaddr } from '$lib/nostr';
import { fetchReleasesForApp } from '$lib/nostr/server';

function parseLimit(raw) {
    const limit = Number(raw);
    if (!Number.isFinite(limit) || limit <= 0)
        return 50;
    return Math.min(Math.floor(limit), 200);
}

export async function GET({ params, url }) {
    const pointer = decodeNaddr(params.naddr);
    if (!pointer) {
        return json({ releases: [], error: 'Invalid app URL' }, { status: 400 });
    }
    const limit = parseLimit(url.searchParams.get('limit'));
    const releases = await fetchReleasesForApp(pointer.pubkey, pointer.identifier, limit);
    return json({ releases, error: null });
}
