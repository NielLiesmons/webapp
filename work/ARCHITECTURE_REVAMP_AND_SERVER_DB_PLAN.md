# Plan: Architecture revamp + Bun → SQLite + server data path

This plan aligns the app with the original performance goal: **extremely fast, data-heavy, offline-first PWA**, with **server-side processing** (render, prerender, prefetch) and **direct database access** for the Zapstore relay instead of relying on websockets at request time.

---

## 1. Goal recap (from original prompt)

- **Feel:** Extremely fast; avoid “typical average SPA” slowness.
- **Offline:** Full PWA with manifest; works fully offline.
- **Server:** Use server processing for render, prerender, prefetch.
- **Nostr:** Access Nostr relays; use a **fast server-side process that talks to the database directly** (especially for Zapstore relay) instead of connecting over websockets at request time.
- **Edge CDN:** Consider later; not the first lever.

---

## 2. Revamp `spec/guidelines/ARCHITECTURE.md`

**Ownership note:** `spec/guidelines/` is normally human-owned; this revamp is done with explicit direction to align the doc with the above goal.

### 2.1 What to change or add

| Section | Current state | Target state |
|--------|----------------|--------------|
| **Stack** | SvelteKit, Applesauce, “Static files served by any CDN” | SvelteKit 2 + **Bun**; **adapter-node**; app at **apex**; **static assets** from CDN (e.g. `assets.example.com`). Local-first unchanged (Applesauce, IndexedDB, EventStore). |
| **Hosting / runtime** | Not described | **Apex:** Bun (or Node) runs SvelteKit server. **Assets:** Served from CDN when `PUBLIC_ASSET_BASE` is set. **Optional:** Separate long-running process for ingest and/or API. |
| **Server data path** | Only “prerender fetches from relays” | Introduce **server-side data source**: for catalog (Zapstore), server reads from **SQLite** (or relay DB) when available; no websocket round-trip at request time. Prerender/SSR/API use this path. |
| **Data flow** | Prerender → first paint → client cascade (EventStore → IndexedDB → Relays) | Keep client cascade. Add: **(1) Prerender/SSR/API:** server reads from **SQLite** (or fallback to relays). **(2) Optional ingest:** background process writes relay events into SQLite. **(3)** Diagram for “server data path” vs “client data path”. |
| **Rendering strategy** | Static/CDN, return visit, offline, build time | Add: **SSR at apex** (Bun serves HTML). Prerender can still run at build time; at runtime, server can use SQLite for fast data. **Prefetch:** document intent (e.g. link prefetch, or API prefetch for next route). |
| **Catalog system** | Default relay `wss://relay.zapstore.dev` | Add: **Zapstore catalog** can be served from **server-owned SQLite** (mirror or direct access to relay DB); server uses DB for feed, app detail, search when configured. |
| **Storage** | IndexedDB, localStorage | Add: **Server:** **SQLite** for catalog events (and optionally materialized views). Path/config to enable “use DB” vs “use relays” for server. |
| **File structure** | Static adapter, no server/ingest | Add: `build/index.js` (server entry), optional **ingest** script or service, optional **API** routes or server-only modules that read from SQLite. |

### 2.2 Principles to state explicitly

- **Local-first (client):** Unchanged. UI always renders from local data first (EventStore → IndexedDB); network is for background refresh; user never waits on network for return visits; app works fully offline with cached data.
- **Server data path:** When SQLite (or relay DB) is available, **prerender, SSR, and any catalog API use it** so the server never blocks on relay websockets. Websockets remain an option for ingest or fallback only.
- **Offline + PWA:** Service worker and manifest stay on apex; assets can be on CDN; precache and fetch strategy support cross-origin assets and offline.

### 2.3 Diagram to add (conceptual)

- **Server data path:** Browser → Apex (Bun/SvelteKit) → SQLite (catalog) for HTML/API; optional ingest process: Relay (Zapstore) → SQLite.
- **Client data path:** (unchanged) EventStore ← IndexedDB ← Relays (background).
- **Assets:** Browser → CDN (`assets.example.com`) for JS/CSS/static; apex for HTML and API.

---

## 3. Bun → SQLite: design and implementation

### 3.1 Role of SQLite

- **Purpose:** Fast, local source of catalog events for the server so that:
  - Prerender / SSR / API do not open websockets to the relay on each request.
  - Queries (feed, app by id, search) are simple reads (indexed).
- **Content:** Mirror of (relevant) events from Zapstore relay (e.g. kinds 32267, 30063, 30267, 1063, 0 for app/release/stack/file/profile as needed). Optionally materialized tables (e.g. “latest app per (pubkey, d)”, “feed order”) for even faster reads.

### 3.2 Who writes into SQLite

- **Option A — Direct access to relay DB:** If Zapstore relay’s backing store is (or is exposed as) SQLite/Postgres, the same Bun process (or a dedicated service) reads from that DB. No separate ingest.
- **Option B — Our own mirror:** A separate **ingest** process (Bun or Node) subscribes to `wss://relay.zapstore.dev`, receives events, and writes them into our SQLite. The web server only reads.
- **Option C — Hybrid:** Read from relay DB when on same host; otherwise run ingest and fill our own SQLite.

Plan should support **Option B** as the default (we own the SQLite file and an ingest process), with configuration so that **Option A** can be used if the relay DB is available.

### 3.3 Schema (minimal)

- **Table: `events`**  
  Columns: `id` (PK), `pubkey`, `kind`, `created_at`, `content`, `tags` (JSON/text), `sig`.  
  Indexes: `(kind)`, `(pubkey, kind)`, `(created_at DESC)`, `(kind, created_at DESC)` for feed; for replaceable events, consider unique `(pubkey, kind, d_tag)` or a materialized “latest” table.
- **Optional:** Materialized views or tables for “apps feed” (e.g. latest release per app, ordered by release `created_at`) and “latest app per (pubkey, d_tag)” for app-detail and search.

### 3.4 Technology choices

- **Driver:** Use **Bun’s built-in SQLite** (`Bun.sqlite` or `bun:sqlite`) or a small wrapper so the server stays on Bun; avoid heavy native deps if possible. If Bun’s SQLite is insufficient, **better-sqlite3** is an option (native addon).
- **Config:** Env var (e.g. `CATALOG_DB_PATH` or `ZAPSTORE_DB_PATH`) pointing to SQLite file. If unset, server falls back to current behavior (fetch from relays via websocket in `src/lib/nostr/server.ts`).

### 3.5 Where it plugs in

- **`src/lib/nostr/server.ts`:** Today it uses `SimplePool` and `fetchEvents()` over websockets. Add a **server-side data module** (e.g. `src/lib/nostr/server-db.ts` or `server/sqlite.ts`) that:
  - Opens SQLite when `CATALOG_DB_PATH` is set.
  - Exposes the same logical API as today: e.g. `fetchAppsByReleases(limit, until)`, `fetchApp(pubkey, identifier)`, `fetchLatestReleaseForApp(...)`, and optionally search.
  - `server.ts` (or `+page.server.ts`) calls this module when DB is configured; otherwise keeps using relay fetch.
- **Build / prerender:** Prerender can use the DB when available (e.g. in CI/staging/production where DB is present); dev without DB continues to use relays.

### 3.6 Ingest process (Option B)

- **Scope:** Single relay `wss://relay.zapstore.dev` (or configurable).
- **Behavior:** Subscribe to needed kinds (32267, 30063, 30267, 1063, 0, …); on each event, INSERT/REPLACE into SQLite; run as a long-lived process (systemd, PM2, or separate container).
- **Output:** One SQLite file (or path) that the web server reads. Optionally expose a small “ingest” script in the repo (e.g. `scripts/ingest-catalog.ts` or `src/server/ingest.ts`) that the deploy runs.

---

## 4. “And more”: API, prefetch, delta (optional)

- **Catalog API (optional but recommended):**  
  GET endpoints that read from SQLite and return JSON, e.g.  
  - `GET /api/feed?limit=40&cursor=...`  
  - `GET /api/apps/:pubkey/:d`  
  - `GET /api/search?q=...`  
  So the client or SSR can get instant data without hitting relays. Can be implemented as SvelteKit server routes or a small Bun HTTP router that uses the same server-db module.
- **Prefetch:**  
  Use `<link rel="prefetch">` or `fetch()` for the next likely route (e.g. app detail or next page of feed) so the first paint is faster. Document in ARCHITECTURE.md.
- **Delta sync (later):**  
  Optional `GET /api/delta?since=<timestamp>` that returns events newer than `since` from SQLite; client merges into IndexedDB for lighter updates.

---

## 5. Implementation order

1. **Plan and doc (this file)** — Done.
2. **Revamp `spec/guidelines/ARCHITECTURE.md`** — Update stack, hosting, server data path, data flow, storage, file structure, and add the server-vs-client diagram. No code yet.
3. **SQLite schema + server-db module** — Define schema (e.g. migration or inline in code), implement `server-db` (or equivalent) that reads from SQLite and exposes `fetchAppsByReleases`, `fetchApp`, `fetchLatestReleaseForApp` (and optionally search). Wire `server.ts` or load functions to use it when `CATALOG_DB_PATH` is set.
4. **Ingest process** — Implement ingest script/process that subscribes to Zapstore relay and writes events into the same SQLite. Document how to run it (systemd, Docker, etc.).
5. **Optional: Catalog API** — Add SvelteKit (or Bun) routes for `/api/feed`, `/api/apps/:pubkey/:d`, `/api/search` that use the server-db module.
6. **Optional: Prefetch and delta** — Document and implement prefetch; later, add delta endpoint and client merge.

---

## 6. Deliverables

- **Updated `spec/guidelines/ARCHITECTURE.md`** reflecting Bun, apex, CDN assets, server SQLite path, ingest, and client/server data flow.
- **SQLite schema** (in code or a small migrations approach) and **server-side read module** used by prerender/SSR when DB is configured.
- **Ingest process** (script or service) that keeps SQLite in sync with the Zapstore relay.
- **Config** (env) to enable “server uses SQLite” vs “server uses relays”.
- **Optional:** Catalog API routes and prefetch/delta as above.

---

## 7. Out of scope for this plan

- Changing the **client** local-first flow (EventStore, IndexedDB, RelayPool). That stays as-is.
- Edge CDN for dynamic logic (only static assets on CDN for now).
- Replacing or modifying the Zapstore relay itself; we only consume it (and optionally mirror into our SQLite).
