import { openDB } from 'idb';
import { IDB_NAME, IDB_VERSION } from '../config';

let dbPromise = null;

function getDb() {
    if (!dbPromise) {
        dbPromise = openDB(IDB_NAME, IDB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('events')) {
                    const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
                    eventsStore.createIndex('lastAccessed', 'lastAccessed');
                    eventsStore.createIndex('kind', 'kind');
                }
            }
        });
    }
    return dbPromise;
}

async function persistEvents(events) {
    if (!Array.isArray(events) || events.length === 0)
        return;
    const db = await getDb();
    const tx = db.transaction('events', 'readwrite');
    const now = Date.now();
    for (const event of events) {
        if (!event?.id)
            continue;
        await tx.store.put({
            id: event.id,
            kind: event.kind,
            lastAccessed: now,
            cachedAt: now,
            event
        });
    }
    await tx.done;
}

self.onmessage = async (message) => {
    const { type, events } = message.data ?? {};
    if (type !== 'events')
        return;
    try {
        await persistEvents(events);
    }
    catch {
        // Worker persistence is best-effort; UI should never fail on cache writes.
    }
};
