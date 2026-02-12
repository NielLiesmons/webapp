import { json } from '@sveltejs/kit';
import { fetchAppsByAuthor, fetchStacksByAuthor } from '$lib/nostr/server';

function parseLimit(raw, fallback) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
        return fallback;
    }
    return Math.min(Math.floor(value), 200);
}

export async function GET({ url }) {
    const pubkey = url.searchParams.get('pubkey')?.trim() ?? '';
    if (!pubkey) {
        return json({ apps: [], stacks: [], resolvedStacks: [] }, { status: 400 });
    }
    const appLimit = parseLimit(url.searchParams.get('appLimit'), 50);
    const stackLimit = parseLimit(url.searchParams.get('stackLimit'), 50);
    const [apps, stacksResult] = await Promise.all([
        fetchAppsByAuthor(pubkey, appLimit),
        fetchStacksByAuthor(pubkey, stackLimit)
    ]);
    return json({
        apps,
        stacks: stacksResult.stacks,
        resolvedStacks: stacksResult.resolvedStacks
    });
}
