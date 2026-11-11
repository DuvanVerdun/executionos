import { parseServerTime } from '../lib/dates';
import { roomSessionStore } from './room-session-state';

/** One measurement of the difference between the server's clock and this one. */
interface ClockSample {
    offsetMs: number;
    /** How long the request took. The offset can be wrong by up to half of this. */
    roundTripMs: number;
}

/** How many recent measurements are kept. At one heartbeat every 15 seconds, this is about two minutes. */
const MAX_SAMPLES = 8;

/** A new measurement this far from the best one means a clock changed, so the old measurements are dropped. */
const CLOCK_CHANGE_MS = 5000;

let samples: ClockSample[] = [];

/** Return the server's current time on the server's clock, in milliseconds. */
export function getServerNowMs(): number {
    return Date.now() + roomSessionStore.get().clockOffsetMs;
}

/** Return the measurement with the shortest request: it has the smallest possible error. */
function mostReliable(list: readonly ClockSample[]): ClockSample | undefined {
    return list.reduce<ClockSample | undefined>(
        /** Keep the sample with the shorter round trip. */ (best, sample) => (best === undefined || sample.roundTripMs < best.roundTripMs ? sample : best),
        undefined
    );
}

/**
 * Measure the difference between the server's clock and this one, from one answer.
 * The server is assumed to have stamped the answer midway through the round trip.
 * The offset in use comes from the most reliable of the recent measurements, so one slow answer cannot move the clock.
 * An answer without send and receive times counts as the least reliable measurement.
 */
export function updateClockOffset(envelope: { server_time: string }, sentAtMs?: number, receivedAtMs?: number): void {
    const timed = sentAtMs !== undefined && receivedAtMs !== undefined;
    const sentAt = sentAtMs ?? Date.now();
    const receivedAt = receivedAtMs ?? sentAt;
    const sample: ClockSample = {
        offsetMs: parseServerTime(envelope.server_time) - (sentAt + receivedAt) / 2,
        roundTripMs: timed ? Math.max(0, receivedAt - sentAt) : Infinity
    };
    const best = mostReliable(samples);
    const clockChanged = best !== undefined && Math.abs(sample.offsetMs - best.offsetMs) > CLOCK_CHANGE_MS;
    samples = [...(clockChanged ? [] : samples), sample].slice(-MAX_SAMPLES);
    roomSessionStore.update({ clockOffsetMs: mostReliable(samples)?.offsetMs ?? sample.offsetMs });
}

/** Forget every measurement. */
export function forgetClockSamples(): void {
    samples = [];
}
