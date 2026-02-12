import { Marked } from 'marked';
/**
 * Markdown → sanitized HTML for user-generated content
 * (app descriptions, release notes, etc.)
 *
 * Uses `marked` for parsing and a post-processing sanitizer that:
 *  - Strips dangerous tags (<script>, <style>, <iframe>, etc.)
 *  - Strips event-handler attributes (onclick, onerror, …)
 *  - Strips javascript: URLs
 *  - Forces external links to open in a new tab with noopener
 */
const marked = new Marked({
    breaks: true, // Convert single \n to <br>
    gfm: true, // GitHub Flavored Markdown (tables, strikethrough, etc.)
});
// ── Sanitiser ────────────────────────────────────────────────────────────
const DANGEROUS_TAG_RE = /<(script|style|iframe|object|embed|form|input|textarea|select|button|applet|base|link|meta)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const DANGEROUS_SELF_CLOSING_RE = /<\/?(script|style|iframe|object|embed|form|input|textarea|select|button|applet|base|link|meta)\b[^>]*\/?>/gi;
const EVENT_HANDLER_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
// Match entire href attribute whose value starts with javascript:
const JAVASCRIPT_URL_RE = /href\s*=\s*(?:"[^"]*javascript\s*:[^"]*"|'[^']*javascript\s*:[^']*'|javascript\s*:[^\s>]*)/gi;
function sanitizeHtml(html) {
    // 1. Remove dangerous tags (with content)
    html = html.replace(DANGEROUS_TAG_RE, '');
    // 2. Remove any remaining dangerous opening / self-closing tags
    html = html.replace(DANGEROUS_SELF_CLOSING_RE, '');
    // 3. Remove event handlers from remaining tags
    html = html.replace(EVENT_HANDLER_RE, '');
    // 4. Neutralise javascript: hrefs (replace entire attribute with safe value)
    html = html.replace(JAVASCRIPT_URL_RE, 'href="#"');
    // 5. Make all <a> links open in new tab safely
    html = html.replace(/<a\s+(?![^>]*target=)/gi, '<a target="_blank" rel="noopener noreferrer" ');
    // Ensure existing <a target=...> also get rel
    html = html.replace(/<a\s+([^>]*?)target="[^"]*"([^>]*)>/gi, (match, pre, post) => {
        if (/rel=/.test(pre + post))
            return match;
        return `<a ${pre}target="_blank" rel="noopener noreferrer"${post}>`;
    });
    return html;
}
// ── Public API ───────────────────────────────────────────────────────────
/**
 * Parse a markdown string and return sanitised HTML.
 *
 * Safe for use with Svelte `{@html …}`.
 */
export function renderMarkdown(text) {
    if (!text)
        return '';
    const html = marked.parse(text);
    return sanitizeHtml(html);
}
