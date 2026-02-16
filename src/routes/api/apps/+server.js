/**
 * /api/apps — Paginated apps ordered by latest release date.
 *
 * Returns app events (kind 32267) AND their latest release events (kind 30063),
 * sorted by release created_at. The client needs both: apps for display,
 * releases for liveQuery ordering in Dexie.
 *
 * Query params:
 *   limit  — page size (default APPS_PAGE_SIZE, max APPS_PAGE_SIZE × 3)
 *   cursor — release created_at cursor from previous page (omit for first page)
 *
 * Response JSON: { events: NostrEvent[], cursor: number|null, hasMore: boolean }
 */
import { json } from '@sveltejs/kit';
import { fetchAppsSortedByRelease } from '$lib/nostr/server.js';
import { APPS_PAGE_SIZE } from '$lib/constants.js';

export async function GET({ url }) {
	const rawLimit = parseInt(url.searchParams.get('limit') || String(APPS_PAGE_SIZE), 10);
	const limit = Math.max(1, Math.min(isNaN(rawLimit) ? APPS_PAGE_SIZE : rawLimit, APPS_PAGE_SIZE * 3));

	const rawCursor = url.searchParams.get('cursor');
	const until = rawCursor ? parseInt(rawCursor, 10) : undefined;

	const result = fetchAppsSortedByRelease(limit, isNaN(until) ? undefined : until);

	return json(result, {
		headers: {
			'Cache-Control': 'public, max-age=60, stale-while-revalidate=120'
		}
	});
}
