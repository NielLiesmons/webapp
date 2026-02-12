/**
 * Catalog (relay) management store
 *
 * Manages user's configured catalog relays.
 * Default catalogs are always included.
 *
 * Note: Custom catalog management (Phase 2 feature) is simplified for now.
 */
import { DEFAULT_CATALOG_RELAYS } from '$lib/config';
const STORAGE_KEY = 'zapstore:catalogs';
// Reactive state
let userCatalogs = $state([]);
let initialized = $state(false);
/**
 * Get all active catalog relays (defaults + user-added)
 */
export function getCatalogs() {
    return [...DEFAULT_CATALOG_RELAYS, ...userCatalogs];
}
/**
 * Initialize catalogs from localStorage
 */
export function initCatalogs() {
    if (initialized)
        return;
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                userCatalogs = JSON.parse(stored);
            }
            catch {
                userCatalogs = [];
            }
        }
    }
    initialized = true;
}
/**
 * Add a custom catalog relay
 */
export function addCatalog(relayUrl) {
    const normalized = relayUrl.trim();
    if (!normalized || getCatalogs().includes(normalized))
        return;
    userCatalogs = [...userCatalogs, normalized];
    persistCatalogs();
}
/**
 * Remove a custom catalog relay
 */
export function removeCatalog(relayUrl) {
    // Can't remove default catalogs
    if (DEFAULT_CATALOG_RELAYS.includes(relayUrl))
        return;
    userCatalogs = userCatalogs.filter((url) => url !== relayUrl);
    persistCatalogs();
}
/**
 * Check if a relay is a default (non-removable) catalog
 */
export function isDefaultCatalog(relayUrl) {
    return DEFAULT_CATALOG_RELAYS.includes(relayUrl);
}
/**
 * Get user-added catalogs only
 */
export function getUserCatalogs() {
    return [...userCatalogs];
}
function persistCatalogs() {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userCatalogs));
    }
}
