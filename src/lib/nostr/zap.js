/**
 * Zap utilities (Lightning/NIP-57)
 *
 * Local-first aligned: create zap request (kind 9734), fetch invoice via LNURL,
 * return invoice for QR / in-browser wallet. Receipt (kind 9735) is published
 * by the recipient's node; we subscribe via relays and optionally refetch zaps.
 */
import { resolveLightningAddress, fetchInvoiceFromCallback, validateZapSupport } from '$lib/lnurl';
import { fetchProfile } from './service';
import { DEFAULT_SOCIAL_RELAYS } from '$lib/config';
import { getPool, initNostrService, getEventStore } from './service';
/**
 * Create a zap request (NIP-57), fetch Lightning invoice from LNURL callback,
 * and return invoice + zap request id for QR display and in-browser wallets.
 *
 * Local-first: we do not block on relay publish for the receipt; the recipient
 * publishes the receipt. Caller can subscribe via subscribeToZapReceipt and/or
 * refetch zaps (e.g. loadZaps) when the user indicates payment is done.
 *
 * @param target - p = author we're zapping (Lightning recipient); e = event id (comment or zap receipt). For zap-on-zap: e = receipt id, p = zap-request author.
 * @param amountSats - Amount in satoshis
 * @param comment - Optional zap message
 * @param signEvent - Auth signer (e.g. from auth store)
 * @param emojiTags - Optional NIP-30 emoji tags for the zap request
 */
export async function createZap(target, amountSats, comment, signEvent, emojiTags) {
    if (!target?.pubkey?.trim()) {
        throw new Error('Zap target must have a pubkey');
    }
    // Normalize to lowercase hex so profile lookup and wallet parsing work (NIP-57 expects hex p-tag)
    const recipientHex = target.pubkey.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(recipientHex)) {
        throw new Error('Zap target pubkey must be a 64-character hex string');
    }
    const amountMillisats = Math.round(amountSats) * 1000;
    if (amountMillisats < 1000) {
        throw new Error('Amount must be at least 1 sat');
    }
    // 1. Get recipient profile for lud16
    const profileEvent = await fetchProfile(recipientHex);
    if (!profileEvent?.content) {
        throw new Error('Could not load recipient profile');
    }
    let profile;
    try {
        profile = JSON.parse(profileEvent.content);
    }
    catch {
        throw new Error('Invalid profile data');
    }
    const lud16 = profile.lud16 ?? profile.lud06;
    if (!lud16) {
        throw new Error('Recipient has no Lightning address (lud16) in their profile');
    }
    if (profile.lud06) {
        throw new Error('LNURL (lud06) is not supported. Recipient should use a Lightning address (lud16).');
    }
    // 2. Resolve LNURL and validate zap support
    const lnurlData = await resolveLightningAddress(lud16);
    validateZapSupport(lnurlData);
    if (amountMillisats < lnurlData.minSendable) {
        throw new Error(`Amount too small. Minimum: ${Math.ceil(lnurlData.minSendable / 1000)} sats`);
    }
    if (amountMillisats > lnurlData.maxSendable) {
        throw new Error(`Amount too large. Maximum: ${Math.floor(lnurlData.maxSendable / 1000)} sats`);
    }
    if (comment && lnurlData.commentAllowed != null && comment.length > lnurlData.commentAllowed) {
        throw new Error(`Comment too long. Maximum ${lnurlData.commentAllowed} characters.`);
    }
    // 3. Build zap request (kind 9734) — tag order must match grimoire/NIP-57 so wallets recognize it: p, amount, relays, lnurl, then e, then a (see grimoire-main/src/lib/create-zap-request.ts).
    const relays = [...DEFAULT_SOCIAL_RELAYS].slice(0, 10);
    const tags = [
        ['p', recipientHex],
        ['amount', amountMillisats.toString()],
        ['relays', relays[0] ?? '', ...relays.slice(1)],
        ['lnurl', lud16]
    ];
    // e-tag when zapping an event (comment, zap receipt, release) — after amount/relays/lnurl so wallet sees standard zap shape.
    if (target.id?.trim()) {
        const eId = target.id.trim().toLowerCase();
        if (/^[a-f0-9]{64}$/.test(eId)) {
            tags.push(['e', eId]);
        }
    }
    // a-tag only when zapping the app/stack itself. Omit for comment/zap-on-zap.
    if (target.aTag) {
        tags.push(['a', target.aTag]);
    }
    else if (target.dTag && recipientHex) {
        tags.push(['a', `32267:${recipientHex}:${target.dTag}`]);
    }
    if (emojiTags?.length) {
        const seen = new Set();
        for (const { shortcode, url } of emojiTags) {
            if (shortcode && url && !seen.has(shortcode)) {
                seen.add(shortcode);
                tags.push(['emoji', shortcode, url]);
            }
        }
    }
    const template = {
        kind: 9734,
        content: comment ?? '',
        tags,
        created_at: Math.floor(Date.now() / 1000)
    };
    const signed = (await signEvent(template));
    if (!signed?.id) {
        throw new Error('Failed to sign zap request');
    }
    const serialized = JSON.stringify(signed);
    // 4. Fetch invoice from LNURL callback
    const invoiceResponse = await fetchInvoiceFromCallback(lnurlData.callback, amountMillisats, serialized, comment || undefined);
    return {
        invoice: invoiceResponse.pr,
        zapRequest: { id: signed.id }
    };
}
/**
 * Subscribe for a zap receipt (kind 9735) from the recipient.
 * Listens on social relays; when a matching receipt is received, calls onReceipt
 * and adds the event to EventStore (local-first) so the UI can show it.
 */
export function subscribeToZapReceipt(recipientPubkey, zapRequestId, onReceipt, _options) {
    let sub = null;
    async function run() {
        await initNostrService();
        const p = getPool();
        const store = getEventStore();
        sub = p
            .req([...DEFAULT_SOCIAL_RELAYS], { kinds: [9735], '#p': [recipientPubkey] })
            .subscribe({
            next: (message) => {
                if (message && typeof message === 'object' && 'kind' in message) {
                    const event = message;
                    // NIP-57: description tag contains the zap request JSON; match our request id
                    const descTag = event.tags?.find((t) => t[0] === 'description')?.[1];
                    if (descTag) {
                        try {
                            const zapReq = JSON.parse(descTag);
                            if (zapReq.id === zapRequestId) {
                                store.add(event);
                                onReceipt(event);
                            }
                        }
                        catch {
                            /* ignore parse */
                        }
                    }
                }
            },
            error: (err) => console.error('[Zap] Receipt subscription error:', err)
        });
    }
    run();
    return () => {
        sub?.unsubscribe();
        sub = null;
    };
}
