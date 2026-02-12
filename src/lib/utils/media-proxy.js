const SHA256_PATTERN = /[a-f0-9]{64}/i;

const BLOSSOM_HOSTS = [
	'blossom.band',
	'cdn.satellite.earth',
	'nostr.build',
	'void.cat',
	'files.v0l.io',
	'media.zapstore.dev'
];

/**
 * Returns true for URLs that are likely immutable media blobs and safe to proxy.
 * We intentionally keep this narrow to avoid introducing a general-purpose proxy.
 *
 * @param {string} value
 */
export function shouldProxyImageUrl(value) {
	if (typeof value !== 'string')
		return false;

	const url = value.trim();
	if (!url || !/^https?:\/\//i.test(url))
		return false;

	try {
		const parsed = new URL(url);
		const hostname = parsed.hostname.toLowerCase();
		const isKnownHost = BLOSSOM_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
		const hasHash = SHA256_PATTERN.test(parsed.pathname);
		return isKnownHost || hasHash;
	}
	catch {
		return false;
	}
}

/**
 * Converts remote immutable media URLs to a first-party route so the browser
 * no longer treats them as third-party resource requests.
 *
 * @param {string | null | undefined} value
 */
export function toFirstPartyImageUrl(value) {
	if (typeof value !== 'string')
		return value ?? null;

	const url = value.trim();
	if (!url)
		return null;
	if (!shouldProxyImageUrl(url))
		return url;

	return `/api/image?url=${encodeURIComponent(url)}`;
}
