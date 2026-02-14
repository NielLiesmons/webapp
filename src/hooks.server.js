/**
 * Server hooks — runs once on server startup.
 *
 * Starts the relay polling cache immediately so seed data is available
 * for server-rendered pages. The cache warms up from upstream relays,
 * then polling timers keep it fresh (runtime only, not during build).
 *
 * Registers graceful shutdown handlers so the process exits promptly
 * when SIGTERM/SIGINT is received (clears timers, closes WebSockets).
 */
import { startPolling, stopPolling } from '$lib/nostr/relay-cache';

startPolling();

function shutdown() {
	stopPolling();
	process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
