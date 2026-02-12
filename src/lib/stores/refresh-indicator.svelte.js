/**
 * Global state for "background refresh in progress".
 * Used to show a subtle indicator when server/relay data is being refreshed.
 * Set to true when starting a background refresh, false when done.
 */
let backgroundRefreshing = $state(false);
export function isBackgroundRefreshing() {
    return backgroundRefreshing;
}
export function setBackgroundRefreshing(value) {
    backgroundRefreshing = value;
}
