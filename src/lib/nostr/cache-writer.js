import { browser } from '$app/environment';

let writer = null;

function getWriter() {
    if (!browser)
        return null;
    if (!writer) {
        writer = new Worker(new URL('../workers/idb-writer.worker.js', import.meta.url), { type: 'module' });
    }
    return writer;
}

export function persistEventsInBackground(events) {
    if (!browser || !Array.isArray(events) || events.length === 0)
        return;
    const worker = getWriter();
    worker?.postMessage({ type: 'events', events });
}
