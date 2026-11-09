// Room invite links.

import { ROOM_JOIN_FRAGMENT } from '../config.js';

/** Return the shareable link for a room token. */
export function buildRoomLink(linkToken) {
    return `${window.location.origin}/${ROOM_JOIN_FRAGMENT}${linkToken}`;
}

/** Return the room link as shown to the user, without the protocol. */
export function buildRoomDisplayLink(linkToken) {
    return `${window.location.host}/${ROOM_JOIN_FRAGMENT}${linkToken}`;
}

/** Extract the token from a pasted room link or bare token. */
export function extractRoomLinkToken(value) {
    const match = value.trim().replace(/\/+$/, '').match(/[A-Za-z0-9_-]+$/);
    return match ? match[0] : '';
}

/** Return the join token in the URL fragment, or null when there is none. */
export function getJoinTokenFromHash() {
    if (!window.location.hash.startsWith(ROOM_JOIN_FRAGMENT)) return null;
    return window.location.hash.slice(ROOM_JOIN_FRAGMENT.length);
}

/** Remove the join fragment from the address bar without reloading. */
export function clearJoinHash() {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}
