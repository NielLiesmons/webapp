# PWA & Offline Verification

Quick verification that the app meets **fully working offline** (INVARIANTS) and installability.

## Service worker

- **Registration:** SvelteKit auto-registers the worker when `src/service-worker.ts` exists; no manual `navigator.serviceWorker.register` in app code.
- **Precache:** On install, `build` + `files` from `$service-worker` are cached; precache match uses both full URL and `pathname` so CDN asset bases work.
- **HTML:** Network-first with cache fallback. Offline fallback now tries, in order: `event.request`, `url.pathname`, origin+pathname, `/`, origin+`/` so pathname-keyed precache and app shell always serve when available instead of raw 503.
- **Same-origin only** for HTML and other requests; external images use a separate cache and 1x1 placeholder on failure.
- **Scope:** Default (same as app); no custom scope.

## Manifest

- **static/manifest.json:** name, short_name, description, start_url `/`, display standalone, theme/background colors, one icon (192x192). Linked from app.html as `%sveltekit.assets%/manifest.json`.
- **Optional:** A 512×512 icon would improve install/splash on some platforms; not required for core offline.

## Offline behavior

- Prerendered routes are in the precache list; after first load, those HTML documents are available offline.
- Navigation to a previously visited page (or any precached path) is served from cache when offline.
- Uncached HTML requests now fall back to app shell (`/`) when possible so the client app can run with local/IndexedDB data.

## Checklist

- [x] SW install/activate and precache
- [x] SW fetch: precache match (URL + pathname), HTML network-first + robust offline fallback
- [x] Manifest linked; valid fields for install
- [x] No manual SW registration needed (Kit handles it)
