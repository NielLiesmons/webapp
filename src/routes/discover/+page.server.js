/**
 * Discover page - server-side data loading
 *
 * Pre-renders apps data for instant first paint,
 * same strategy as /apps page.
 */
import { fetchAppsByReleases } from '$lib/nostr/server';
export const prerender = true;
const PAGE_SIZE = 40;
export const load = async () => {
    // Fetch first page of releases and resolve to apps
    const { apps, nextCursor, seedEvents } = await fetchAppsByReleases(PAGE_SIZE);
    return {
        apps,
        seedEvents,
        nextCursor,
        fetchedAt: Date.now()
    };
};
