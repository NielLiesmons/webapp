import { shouldProxyImageUrl } from '$lib/utils/media-proxy.js';

const CACHE_HEADER = 'public, max-age=31536000, immutable';

export async function GET({ url, fetch }) {
	const target = url.searchParams.get('url')?.trim();

	if (!target || !shouldProxyImageUrl(target)) {
		return new Response('Invalid image URL', { status: 400 });
	}

	let upstream;
	try {
		upstream = await fetch(target, {
			redirect: 'follow',
			headers: {
				accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
			}
		});
	}
	catch {
		return new Response('Upstream fetch failed', { status: 502 });
	}

	if (!upstream.ok || !upstream.body) {
		return new Response('Image unavailable', { status: upstream.status || 502 });
	}

	const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
	const contentLength = upstream.headers.get('content-length');
	const cacheControl = upstream.headers.get('cache-control') || CACHE_HEADER;

	const headers = new Headers({
		'content-type': contentType,
		'cache-control': cacheControl
	});

	if (contentLength)
		headers.set('content-length', contentLength);

	return new Response(upstream.body, { status: 200, headers });
}
