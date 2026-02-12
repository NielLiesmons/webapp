/**
 * NIP-19 naddr encoding/decoding utilities
 * Uses applesauce-core helpers (which re-export from nostr-tools)
 */
import { naddrEncode, decodeAddressPointer } from 'applesauce-core/helpers/pointers';
/**
 * Encode an address pointer to naddr string
 */
export function encodeNaddr(pointer) {
    return naddrEncode(pointer);
}
/**
 * Decode an naddr string to address pointer
 */
export function decodeNaddr(naddr) {
    try {
        return decodeAddressPointer(naddr);
    }
    catch {
        // Invalid naddr
        return null;
    }
}
