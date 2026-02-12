const CONNECT_TIMEOUT_MS = 3500;
const QUERY_TIMEOUT_MS = 3500;
const WS = globalThis.WebSocket;
const timerSet = globalThis.setTimeout;
const timerClear = globalThis.clearTimeout;

function makeSubId() {
    return `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRelayUrl(url) {
    return url?.trim();
}

function isEventLike(event) {
    return Boolean(event &&
        typeof event === 'object' &&
        typeof event.id === 'string' &&
        typeof event.kind === 'number' &&
        typeof event.pubkey === 'string' &&
        Array.isArray(event.tags));
}

class RelayConnection {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.openPromise = null;
        this.subscriptions = new Map();
        this.reconnectTimer = null;
    }
    async ensureOpen() {
        if (!WS) {
            throw new Error('WebSocket is unavailable in this runtime');
        }
        if (this.ws && this.ws.readyState === WS.OPEN) {
            return;
        }
        if (this.openPromise) {
            return this.openPromise;
        }
        this.openPromise = new Promise((resolve, reject) => {
            let settled = false;
            const timeout = timerSet(() => {
                if (settled)
                    return;
                settled = true;
                this.openPromise = null;
                reject(new Error(`Relay connect timeout: ${this.url}`));
            }, CONNECT_TIMEOUT_MS);
            try {
                const ws = new WS(this.url);
                this.ws = ws;
                ws.addEventListener('open', () => {
                    if (settled)
                        return;
                    settled = true;
                    timerClear(timeout);
                    this.openPromise = null;
                    resolve();
                });
                ws.addEventListener('message', (message) => {
                    this.handleMessage(String(message.data));
                });
                ws.addEventListener('close', () => {
                    this.handleClose();
                });
                ws.addEventListener('error', () => {
                    if (!settled) {
                        settled = true;
                        timerClear(timeout);
                        this.openPromise = null;
                        reject(new Error(`Relay connect error: ${this.url}`));
                        return;
                    }
                    this.handleClose();
                });
            }
            catch (error) {
                timerClear(timeout);
                this.openPromise = null;
                reject(error);
            }
        });
        return this.openPromise;
    }
    handleMessage(raw) {
        let message;
        try {
            message = JSON.parse(raw);
        }
        catch {
            return;
        }
        if (!Array.isArray(message) || message.length < 2) {
            return;
        }
        const type = message[0];
        const subId = message[1];
        if (typeof subId !== 'string') {
            return;
        }
        const handlers = this.subscriptions.get(subId);
        if (!handlers) {
            return;
        }
        if (type === 'EVENT' && message.length >= 3) {
            const event = message[2];
            if (isEventLike(event)) {
                handlers.onEvent?.(event);
            }
            return;
        }
        if (type === 'EOSE') {
            handlers.onEose?.();
            return;
        }
        if (type === 'CLOSED') {
            handlers.onError?.();
        }
    }
    handleClose() {
        this.ws = null;
        for (const [, handlers] of this.subscriptions) {
            handlers.onError?.();
        }
        this.subscriptions.clear();
        if (this.reconnectTimer) {
            timerClear(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectTimer = timerSet(() => {
            this.reconnectTimer = null;
            void this.ensureOpen().catch(() => {
                // Best-effort reconnect. Query path handles per-request fallback.
            });
        }, 1000);
    }
    async request(subId, filter, handlers) {
        await this.ensureOpen();
        const ws = this.ws;
        if (!ws || !WS || ws.readyState !== WS.OPEN) {
            throw new Error(`Relay not open: ${this.url}`);
        }
        this.subscriptions.set(subId, handlers);
        ws.send(JSON.stringify(['REQ', subId, filter]));
    }
    closeSub(subId) {
        const ws = this.ws;
        if (ws && WS && ws.readyState === WS.OPEN) {
            ws.send(JSON.stringify(['CLOSE', subId]));
        }
        this.subscriptions.delete(subId);
    }
}

class RelayPool {
    constructor() {
        this.relays = new Map();
    }
    getRelay(url) {
        const normalized = normalizeRelayUrl(url);
        if (!normalized) {
            return null;
        }
        let relay = this.relays.get(normalized);
        if (!relay) {
            relay = new RelayConnection(normalized);
            this.relays.set(normalized, relay);
        }
        return relay;
    }
    async queryEvents(relayUrls, filter, timeoutMs = QUERY_TIMEOUT_MS) {
        if (typeof Bun === 'undefined') {
            return [];
        }
        const urls = relayUrls.map(normalizeRelayUrl).filter(Boolean);
        if (urls.length === 0) {
            return [];
        }
        const eventsById = new Map();
        await Promise.all(urls.map(async (url) => {
            const relay = this.getRelay(url);
            if (!relay)
                return;
            const subId = makeSubId();
            await new Promise((resolve) => {
                let done = false;
                const finish = () => {
                    if (done)
                        return;
                    done = true;
                    relay.closeSub(subId);
                    resolve();
                };
                const timer = timerSet(finish, timeoutMs);
                relay.request(subId, filter, {
                    onEvent: (event) => {
                        eventsById.set(event.id, event);
                    },
                    onEose: () => {
                        timerClear(timer);
                        finish();
                    },
                    onError: () => {
                        timerClear(timer);
                        finish();
                    }
                }).catch(() => {
                    timerClear(timer);
                    finish();
                });
            });
        }));
        return Array.from(eventsById.values());
    }
}

const relayPool = new RelayPool();

export async function queryRelays(relayUrls, filter, options = {}) {
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : QUERY_TIMEOUT_MS;
    return relayPool.queryEvents(relayUrls, filter, timeoutMs);
}
