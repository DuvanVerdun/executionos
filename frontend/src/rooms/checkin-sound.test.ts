import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { armCheckinSound, cancelCheckinSound } from './checkin-sound';
import { roomSessionStore } from './room-session-state';
import { checkinAudio } from './state';

const NOW = new Date('2026-11-16T12:00:00Z').getTime();

/** A sound the fake audio context can schedule. It remembers when it starts and whether it was stopped. */
interface FakeSource {
    buffer: unknown;
    connect: () => void;
    start: ReturnType<typeof vi.fn<(when: number) => void>>;
    stop: ReturnType<typeof vi.fn<() => void>>;
}

/** Put a fake audio context and a decoded sound in the check-in audio. Return the sounds the context makes. */
function useFakeAudio(): FakeSource[] {
    const sources: FakeSource[] = [];
    const context = {
        state: 'running',
        currentTime: 100,
        destination: {},
        createBufferSource: () => {
            const source: FakeSource = { buffer: null, connect: () => undefined, start: vi.fn(), stop: vi.fn() };
            sources.push(source);
            return source;
        }
    };
    Object.assign(checkinAudio, { context, buffer: {}, sources: [] });
    return sources;
}

/** Make a running room session whose check-in is due at the given moment. */
function runSessionDueAt(dueAtMs: number | null): void {
    roomSessionStore.update({ active: true, isPaused: false, checkin: { dueAtMs, deadlineAtMs: null, outstanding: false } });
}

/** Read the moments, in seconds from now, when the sounds start. */
function startsOf(sources: FakeSource[]): number[] {
    return sources.map(/** Read when one sound starts. */ (source) => (source.start.mock.calls[0]?.[0] ?? 0) - 100);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
});

afterEach(() => {
    Object.assign(checkinAudio, { context: null, buffer: null, sources: [] });
    vi.useRealTimers();
});

describe('the check-in sound', () => {
    it('plays when the check-in is due, and again every 10 seconds until the 5 minutes to answer are over', () => {
        const sources = useFakeAudio();
        runSessionDueAt(NOW + 5000);
        armCheckinSound();
        const starts = startsOf(sources);
        expect(starts).toHaveLength(30);
        expect(starts.slice(0, 3)).toEqual([5, 15, 25]);
        expect(starts.at(-1)).toBe(295);
    });

    it('plays only the repeats that are still to come when the check-in is already waiting', () => {
        const sources = useFakeAudio();
        runSessionDueAt(NOW - 25_000);
        armCheckinSound();
        const starts = startsOf(sources);
        expect(starts[0]).toBe(5);
        expect(starts).toHaveLength(27);
    });

    it('plays nothing once the time to answer is over', () => {
        const sources = useFakeAudio();
        runSessionDueAt(NOW - 300_000);
        armCheckinSound();
        expect(sources).toHaveLength(0);
    });

    it('plays nothing while the session is paused, or when no check-in is due', () => {
        const sources = useFakeAudio();
        runSessionDueAt(NOW + 5000);
        roomSessionStore.update({ isPaused: true });
        armCheckinSound();
        runSessionDueAt(null);
        armCheckinSound();
        expect(sources).toHaveLength(0);
    });

    it('stops every scheduled sound when it is cancelled, and when it is armed again', () => {
        const sources = useFakeAudio();
        runSessionDueAt(NOW + 5000);
        armCheckinSound();
        cancelCheckinSound();
        expect(sources.every(/** Check that a sound was stopped. */ (source) => source.stop.mock.calls.length === 1)).toBe(true);
        expect(checkinAudio.sources).toEqual([]);

        armCheckinSound();
        armCheckinSound();
        expect(sources).toHaveLength(90);
        expect(sources.slice(30, 60).every(/** Check that the older sound was stopped. */ (source) => source.stop.mock.calls.length === 1)).toBe(true);
    });
});
