function decodeEntities(value) {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

export function parseChunkHtmlPayload(html) {
    const match = html.match(/<script id="zapstore-chunk-payload" type="application\/json">([\s\S]*?)<\/script>/i);
    if (!match)
        throw new Error('Missing chunk payload script');
    const raw = decodeEntities(match[1] ?? '').trim();
    return JSON.parse(raw);
}
