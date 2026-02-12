import { fetchStacks } from '$lib/nostr/server';

const PAGE_SIZE = 20;

export const load = async () => {
    const { stacks, resolvedStacks, nextCursor, seedEvents } = await fetchStacks(PAGE_SIZE);
    return {
        stacks,
        resolvedStacks,
        nextCursor,
        seedEvents,
        fetchedAt: Date.now()
    };
};
