# Performance

**Mandatory for all UI/UX and data work.** Follow these rules whenever you add or change UI, routes, data loading, or Nostr/relay code.

---

## 1. Local-first: UI never waits on network

- **NEVER** block first paint on relay requests, IndexedDB, or any network/disk `await`.
- **ALWAYS** show content from memory or prerendered `data` first; relay work runs after first paint (e.g. `onMount`, after `initWithPrerenderedData`).
- **NEVER** remove the “prerendered until store initialized, then store” pattern (§3).

---

## 2. Prerender: bounded only

- **NEVER** add a server function that fetches all apps/releases or any unbounded list from relays.
- **NEVER** use `entries()` to prerender every detail page (e.g. every `[naddr]`, every `[npub]`).
- **Listing pages** (`/apps`, `/discover`): prerender one page only (e.g. `fetchAppsByReleases(PAGE_SIZE)`). No “fetch until no more” loop.
- **Detail pages** (`/apps/[naddr]`, `/profile/[npub]`, `/stacks/[naddr]`): **MUST** use `+page.ts` with `prerender = false`. Load data on the client (EventStore → IndexedDB → Relays). No `+page.server.ts` that fetches at build time; no `entries()`.

---

## 3. Store “initialized” flag and display logic

- Routes that use both prerendered `data` and a client store (e.g. apps listing, discover) **MUST**:
  - Store has `initialized` set to `true` only after `initWithPrerenderedData(...)` (or equivalent) is called on the client.
  - Page uses a getter (e.g. `isStoreInitialized()`).
  - Display logic: **`displayData = isStoreInitialized() ? storeData : data.fromServer`**. Never “if store empty then server data.”
- **NEVER** remove `initialized` / `isStoreInitialized()` or switch to “store empty” logic.

---

## 4. Relay requests: timeouts and lifecycle

- **EVERY** relay fetch or subscription **MUST** have a timeout (e.g. 5–10 s). Never wait indefinitely.
- **EVERY** subscription or long-lived listener **MUST** be closed in Svelte cleanup (`onDestroy`, `$effect` cleanup). No leaking subscriptions.
- New relay calls **MUST** pass `timeout` (and `signal` when applicable).

---

## 5. SSR / browser guards

- Code that uses `window`, `document`, `navigator`, or URL search params **MUST** be guarded (`if (browser) { ... }` or run only in `onMount`). Prerendered pages must not assume a browser.

---

## 6. Batch relay requests (what franzap fixed)

- **When resolving many app/event refs of the same kind:** Group by `pubkey` and issue **one request per pubkey** with `authors: [pubkey]` and `#d`: [id1, id2, ...]. Do **not** loop over refs with one request per ref. (See `fetchAppsByReleases` in server.ts and service.ts, and `resolveStackApps` / `resolveMultipleStackApps` in stacks.svelte.ts.)
- **When resolving apps for multiple parent entities (e.g. many stacks):** Use **one batched operation** that collects all refs across all parents, groups by pubkey, fetches once, then maps results back to each parent. Do **not** call "resolve for one parent" in a loop for each parent. (See `resolveMultipleStackApps` and its use on profile and stacks pages.)
- **Do NOT apply PLATFORM_FILTER to release queries.** Releases (kind 30063) do not have the `#f` platform tag. Only apply `PLATFORM_FILTER` to app queries (kind 32267). Franzap removed it from all release queries in commit 9ea1b5f.
- **Unbounded server fetches and per-entity build fetches** are already forbidden in §2 (no fetch-all, no entries() per app). Those were the main source of request volume at build time.

---

## 7. Do not re-introduce

- **Do not** add `paths.assets` (or similar) to `svelte.config.js` if it has caused broken asset URLs or load failures.
- **Do not** add server-side “fetch all” or prerender of every detail page. Detail pages are client-loaded.

---

## 8. Checklist (data loading, routes, Nostr)

- [ ] No new code blocks UI on network or IndexedDB before first paint.
- [ ] Listing pages: `displayData = isStoreInitialized() ? storeData : data.fromServer` (or equivalent).
- [ ] No new `entries()` or unbounded server fetch from relays.
- [ ] Detail routes use `prerender = false`, client-side load only.
- [ ] All new relay calls have a timeout and cleanup on unmount.
- [ ] Loading/error/empty states are explicit.
- [ ] Many refs of same kind: batched by pubkey (one request per pubkey). Multiple parents: one batched resolve, not per-parent loop.
