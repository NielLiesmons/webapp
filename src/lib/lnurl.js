/**
 * LNURL utilities for Lightning address resolution and zap support (NIP-57).
 * Adapted from grimoire for local-first webapp use.
 */
/**
 * Resolve a Lightning address (lud16) to LNURL-pay endpoint data.
 * Converts user@domain.com to https://domain.com/.well-known/lnurlp/user
 */
export async function resolveLightningAddress(address) {
    const parts = address.split('@');
    if (parts.length !== 2) {
        throw new Error('Invalid Lightning address format. Expected: user@domain.com');
    }
    const [username, domain] = parts;
    const url = `https://${domain}/.well-known/lnurlp/${username}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`Failed to fetch LNURL data: ${response.status} ${response.statusText}`);
        }
        const data = (await response.json());
        if (data.tag !== 'payRequest') {
            throw new Error(`Invalid LNURL response: expected tag "payRequest", got "${data.tag}"`);
        }
        if (!data.callback) {
            throw new Error('LNURL response missing callback URL');
        }
        return data;
    }
    catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('Lightning address request timed out. Please try again.');
        }
        throw err;
    }
}
/**
 * Fetch invoice from LNURL callback with zap request (NIP-57).
 * @param callbackUrl - Callback URL from LNURL-pay response
 * @param amountMillisats - Amount in millisatoshis
 * @param zapRequestEvent - Signed kind 9734 zap request (JSON string)
 * @param comment - Optional comment (if allowed by LNURL service)
 */
export async function fetchInvoiceFromCallback(callbackUrl, amountMillisats, zapRequestEvent, comment) {
    const url = new URL(callbackUrl);
    url.searchParams.set('amount', amountMillisats.toString());
    url.searchParams.set('nostr', zapRequestEvent);
    if (comment) {
        url.searchParams.set('comment', comment);
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`Failed to fetch invoice (${response.status}): ${errorText || response.statusText}`);
        }
        const data = (await response.json());
        if (!data.pr) {
            throw new Error('LNURL callback response missing invoice (pr field)');
        }
        return data;
    }
    catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
            throw new Error('Invoice request timed out. Please try again.');
        }
        throw err;
    }
}
/**
 * Validate that a LNURL service supports Nostr zaps (NIP-57).
 */
export function validateZapSupport(lnurlData) {
    if (!lnurlData.allowsNostr) {
        throw new Error('This Lightning address does not support Nostr zaps (allowsNostr is false)');
    }
    if (!lnurlData.nostrPubkey) {
        throw new Error('LNURL service missing nostrPubkey (required for zaps)');
    }
    if (!/^[0-9a-f]{64}$/i.test(lnurlData.nostrPubkey)) {
        throw new Error('Invalid nostrPubkey format in LNURL response');
    }
}
