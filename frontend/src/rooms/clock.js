// Server clock offset used by room sessions.

import { parseServerTime } from '../lib/dates.js';
import { roomSessionState } from './state.js';

/** Return the current time on the server's clock, in milliseconds. */
export function getServerNowMs() {
    return Date.now() + roomSessionState.clockOffsetMs;
}

/** Estimate the server clock offset, assuming the server stamped the reply midway through the round trip. */
export function updateClockOffset(envelope, sentAtMs = Date.now(), receivedAtMs = Date.now()) {
    roomSessionState.clockOffsetMs = parseServerTime(envelope.server_time) - (sentAtMs + receivedAtMs) / 2;
}
