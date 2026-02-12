import { decodeNaddr } from '$lib/nostr';
import { fetchApp, fetchLatestReleaseForApp, fetchReleasesForApp } from '$lib/nostr/server';

export const prerender = false;

export const load = async ({ params }) => {
    const pointer = decodeNaddr(params.naddr);
    if (!pointer) {
        return {
            app: null,
            latestRelease: null,
            error: 'Invalid app URL'
        };
    }
    const { pubkey, identifier } = pointer;
    const [app, latestRelease] = await Promise.all([
        fetchApp(pubkey, identifier),
        fetchLatestReleaseForApp(pubkey, identifier)
    ]);
    if (!app) {
        return {
            app: null,
            latestRelease: null,
            error: 'App not found'
        };
    }
    const releases = await fetchReleasesForApp(pubkey, identifier, 50);
    return {
        app,
        latestRelease,
        releases,
        error: null
    };
};
