import { nip19 } from 'nostr-tools';
import { fetchAppsByAuthor, fetchStacksByAuthor, fetchProfilesServer } from '$lib/nostr/server';
import { parseProfile } from '$lib/nostr/models';

export const prerender = false;

/** Profiles whose apps list is restricted to a specific dTag prefix */
const PROFILE_APP_FILTERS = {
    'npub10r8xl2njyepcw2zwv3a6dyufj4e4ajx86hz6v4ehu4gnpupxxp7stjt2p8': 'dev.zapstore'
};

export const load = async ({ params }) => {
    const npub = params.npub ?? '';
    let pubkey = null;
    try {
        const decoded = nip19.decode(npub);
        if (decoded.type === 'npub') {
            pubkey = decoded.data;
        }
    }
    catch {
        pubkey = null;
    }
    if (!pubkey) {
        return { npub, pubkey: null, profile: null, apps: [], stacks: [], resolvedStacks: [] };
    }

    const [profileMap, apps, stacksResult] = await Promise.all([
        fetchProfilesServer([pubkey], { timeout: 5000 }),
        fetchAppsByAuthor(pubkey, 50),
        fetchStacksByAuthor(pubkey, 50)
    ]);

    const profileEvent = profileMap.get(pubkey) ?? null;
    const profile = profileEvent ? parseProfile(profileEvent) : null;

    // Apply per-profile app filter (e.g. only show "dev.zapstore.*" apps for certain profiles)
    const dTagPrefix = PROFILE_APP_FILTERS[npub];
    const filteredApps = dTagPrefix ? apps.filter((app) => app.dTag?.startsWith(dTagPrefix)) : apps;

    return {
        npub,
        pubkey,
        profile,
        apps: filteredApps,
        stacks: stacksResult.stacks,
        resolvedStacks: stacksResult.resolvedStacks
    };
};
