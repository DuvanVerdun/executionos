import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getServerNowMs, updateClockOffset } from './clock';
import { roomSessionStore } from './room-session-state';

const NOW = new Date('2026-11-09T12:00:00Z').getTime();

/** Answer as the server would when its clock is `serverAheadMs` ahead, for a request that took `roundTripMs`. */
function measure(serverAheadMs: number, roundTripMs: number): void {
    const sentAt = NOW;
    const receivedAt = NOW + roundTripMs;
    const serverTime = new Date((sentAt + receivedAt) / 2 + serverAheadMs).toISOString().replace('Z', '');
    updateClockOffset({ server_time: serverTime }, sentAt, receivedAt);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('the server clock offset', () => {
    it('is the difference between the server clock and this one', () => {
        measure(1500, 100);
        expect(roomSessionStore.get().clockOffsetMs).toBeCloseTo(1500, 0);
    });

    it('gives the server time, from this clock plus the offset', () => {
        measure(1500, 100);
        expect(getServerNowMs()).toBeCloseTo(NOW + 1500, 0);
    });

    it('keeps the measurement of the fastest request, because a short round trip has a small error', () => {
        measure(1000, 40);
        measure(1180, 500);
        expect(roomSessionStore.get().clockOffsetMs).toBeCloseTo(1000, 0);
    });

    it('switches to a faster request when one comes', () => {
        measure(1180, 500);
        measure(1000, 40);
        expect(roomSessionStore.get().clockOffsetMs).toBeCloseTo(1000, 0);
    });

    it('does not move when slower answers keep coming in', () => {
        measure(1000, 60);
        const before = roomSessionStore.get().clockOffsetMs;
        for (const [ahead, trip] of [[1090, 300], [940, 250], [1120, 420], [1060, 180]] as const) measure(ahead, trip);
        expect(roomSessionStore.get().clockOffsetMs).toBe(before);
    });

    it('forgets old measurements, so one lucky fast answer does not rule forever', () => {
        measure(1000, 20);
        for (let index = 0; index < 8; index += 1) measure(1100, 200 + index);
        expect(roomSessionStore.get().clockOffsetMs).toBeCloseTo(1100, 0);
    });

    it('starts again when a clock changed by more than a few seconds', () => {
        measure(1000, 20);
        measure(61_000, 300);
        expect(roomSessionStore.get().clockOffsetMs).toBeCloseTo(61_000, 0);
    });

    it('uses an answer without times only when there is nothing better', () => {
        updateClockOffset({ server_time: new Date(NOW + 800).toISOString().replace('Z', '') });
        expect(roomSessionStore.get().clockOffsetMs).toBeCloseTo(800, 0);
        measure(1000, 100);
        expect(roomSessionStore.get().clockOffsetMs).toBeCloseTo(1000, 0);
        updateClockOffset({ server_time: new Date(NOW + 300).toISOString().replace('Z', '') });
        expect(roomSessionStore.get().clockOffsetMs).toBeCloseTo(1000, 0);
    });
});
