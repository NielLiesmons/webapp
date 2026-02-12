import { json } from '@sveltejs/kit';
import { fetchStacks } from '$lib/nostr/server';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 80;

function parseLimit(raw) {
    const limit = Number(raw);
    if (!Number.isFinite(limit) || limit <= 0) {
        return DEFAULT_LIMIT;
    }
    return Math.min(Math.floor(limit), MAX_LIMIT);
}

function parseCursor(raw) {
    if (!raw)
        return undefined;
    const cursor = Number(raw);
    if (!Number.isFinite(cursor))
        return undefined;
    return Math.floor(cursor);
}

export async function GET({ url }) {
    const limit = parseLimit(url.searchParams.get('limit'));
    const cursor = parseCursor(url.searchParams.get('cursor'));
    const { stacks, resolvedStacks, nextCursor } = await fetchStacks(limit, cursor);
    return json({
        stacks,
        resolvedStacks,
        nextCursor
    });
}
import { json } from '@sveltejs/kit';
import { fetchStacks } from '$lib/nostr/server';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function parsePositiveInt(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}

export const GET = async ({ url }) => {
    const limit = Math.min(parsePositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT), MAX_LIMIT);
    const untilParam = url.searchParams.get('until');
    const until = untilParam ? Number.parseInt(untilParam, 10) : undefined;
    const safeUntil = Number.isFinite(until) ? until : undefined;
    const author = url.searchParams.get('author')?.trim();
    const result = await fetchStacks(limit, safeUntil, author ? { authors: [author] } : undefined);
    return json(result);
};
