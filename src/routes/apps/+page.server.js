/**
 * Apps listing page - server-side data loading
 *
 * Data loading strategy:
 * - Load releases (kind 30063) sorted by created_at
 * - For each release, find its app (kind 32267)
 * - Pre-render first 40 apps for instant first paint
 * - Client hydrates and paginates for remaining apps
 */
import { fetchAppsByReleases } from '$lib/nostr/server';
const PAGE_SIZE = 40;
export const prerender = true;
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
