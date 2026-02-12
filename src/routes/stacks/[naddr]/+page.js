/**
 * Stack detail page - client-only to avoid SSR/500 on dynamic naddr.
 * Data is loaded in +page.svelte via onMount (fetchAppStacksParsed, etc.).
 */
export const prerender = false;
export const load = async () => {
    return {};
};
