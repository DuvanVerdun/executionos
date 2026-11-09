import { parseServerTime } from '../lib/dates';
import { roomSessionStore } from './room-session-state';

/** Return the current time on the server's clock, in milliseconds. */
export function getServerNowMs(): number {
    return Date.now() + roomSessionStore.get().clockOffsetMs;
}

/** Estimate the server clock offset, assuming the server stamped the reply midway through the round trip. */
export function updateClockOffset(envelope: { server_time: string }, sentAtMs: number = Date.now(), receivedAtMs: number = Date.now()): void {
    roomSessionStore.update({ clockOffsetMs: parseServerTime(envelope.server_time) - (sentAtMs + receivedAtMs) / 2 });
}
