import { json } from '@sveltejs/kit';
import { decodeNaddr } from '$lib/nostr';
import { fetchApp, fetchLatestReleaseForApp } from '$lib/nostr/server';

export async function GET({ params }) {
    const pointer = decodeNaddr(params.naddr);
    if (!pointer) {
        return json({ app: null, latestRelease: null, error: 'Invalid app URL' }, { status: 400 });
    }
    const { pubkey, identifier } = pointer;
    const [app, latestRelease] = await Promise.all([
        fetchApp(pubkey, identifier),
        fetchLatestReleaseForApp(pubkey, identifier)
    ]);
    if (!app) {
        return json({ app: null, latestRelease: null, error: 'App not found' }, { status: 404 });
    }
    return json({ app, latestRelease, error: null });
}
