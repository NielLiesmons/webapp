# Zapstore Webapp — Invariants

These are non-negotiable rules. Violating any invariant is a bug—no tradeoffs or exceptions.
See `QUALITY_BAR.md` for best practices that involve judgment.

## Local-First (FUNDAMENTAL)

These are the most critical invariants. Local-first is not optional.

- **UI NEVER waits for network** — always render from local data first.
- **IndexedDB is the source of truth** for the UI, not relays.
- **Relay fetches are background-only** — they update local cache, UI reacts.
- **Offline mode is fully functional** — the app works fully offline; all cached data and routes remain accessible without network.
- **Online status determines relay behavior** — skip fetches when offline.
- Network failures degrade gracefully with clear feedback (offline banner).
- **UI MUST update reactively** when local or server/background data changes—no full page reload required. Use reactive state so new data flows into the view immediately.
- Fresh data updates UI reactively without blocking or reload.

## Performance

- First Contentful Paint (FCP) must be under 1.5 seconds on 3G.
- Time to Interactive (TTI) must be under 3 seconds on 3G.
- Pre-rendered pages must not require JavaScript for initial content.
- Client-side navigation must feel instant (<100ms perceived).
- **Loading states and skeletons must be minimal.** First paint must show real content from local data or prerender whenever possible. Use loading spinners or skeletons only where necessary (e.g. true first-ever empty state, explicit search-in-flight). Avoid the classic SPA pattern of loading/skeletons everywhere.

## Relay Fetching

- Prerendered content displays immediately; relay fetch is background refresh.
- Relay fetches must have a timeout (default 5 seconds).
- Never wait indefinitely for relay responses.
- Fresh data updates UI reactively without blocking.

## Storage Management

- IndexedDB MUST implement LRU (Least Recently Used) eviction.
- Eviction triggers when storage approaches browser limits.
- Recently accessed data is preserved; old data is evicted.
- Eviction must not break the app — graceful degradation to network fetch.

## Search

- Search is ALWAYS a remote relay query — never pre-rendered or from cache.
- Search MUST show a loading spinner while querying.
- Search queries all configured catalog relays using NIP-50.
- Search results are cached in IndexedDB for back-navigation only.

## UI Safety

- UI rendering must remain responsive under network failure.
- The UI must never block on relay connections or storage operations.
- All async work must be cancellable and lifecycle-safe (cleanup on unmount).
- All data-dependent UI must have explicit states: loading, empty, success, error.
- Silent failures are unacceptable—users must know when something fails.
- Where a loading state is required, use skeletons to preserve layout; but prefer showing real content from cache so loading states are rare.

## Async Discipline

- No polling or artificial delays.
- Relay subscriptions must be cleaned up on component destroy.
- All promises must handle rejection (no unhandled promise rejections).
- Concurrent requests must be deduplicated where appropriate.

## Security

- User secrets (nsec, NWC strings) must never be logged or sent to server.
- NIP-07 extension interactions must be user-initiated.
- External links must use `rel="noopener noreferrer"`.
- User-generated content must be sanitized before rendering as HTML.

## Data Robustness

- Parsing unknown, missing, or future event tags must not crash the app.
- Partial or invalid Nostr events must degrade gracefully.
- Malformed relay responses must not break the UI.

## Lifecycle Safety

- Svelte `$effect` cleanup functions must cancel subscriptions.
- Component destroy must unsubscribe from all relay subscriptions.
- Service worker updates must not break active sessions.

## SEO

- App detail pages must be fully pre-rendered with complete metadata.
- Pages must have appropriate `<title>`, `<meta description>`, and Open Graph tags.
- URLs must be stable and human-readable.

## Prerendering

- All app pages are prerendered at build time via SvelteKit.
- Prerendered HTML must be valid and complete.
- Build failures must not deploy broken pages.

## PWA

- The app MUST be a full Progressive Web App: valid web app manifest and a compliant service worker.
- Manifest: name, short_name, start_url, display, icons, theme_color (and any required fields) must be present and correct.
- Service worker: must handle install (precache), activate (clean old caches, claim), and fetch (cache-first for assets, network-first with cache fallback for documents). Scope must be the app origin.
- **Fully working offline:** Cached routes and local data (IndexedDB) must allow the app to function fully offline—no network required for previously visited content. Show an offline indicator when appropriate.
