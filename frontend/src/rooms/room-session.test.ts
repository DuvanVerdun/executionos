import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentScreenName, screenStore } from '../shared/navigation';
import { fakeBackendByPath, type FakeAnswer } from '../test/network';
import type { RoomSessionEnvelope } from '../types/rooms';
import { getServerNowMs } from './clock';
import {
    applyRoomSessionEnvelope,
    enterRoomSessionFocus,
    handleRoomPauseResume,
    handleRoomStop,
    handleRoomTabVisible,
    resetRoomSessionClient
} from './room-session';
import { roomSessionStore } from './room-session-state';

const NOW = new Date('2026-11-09T12:00:00Z').getTime();
const HOUR_MS = 3_600_000;

/** Write a moment the way the server does: UTC, without the Z. */
function serverTime(ms: number): string {
    return new Date(ms).toISOString().replace('Z', '');
}

/** What the server says about a room session. All times are in milliseconds of the test clock. */
interface Session {
    startedAtMs: number;
    pausedAtMs?: number;
    pausedSeconds?: number;
    /** How far the server clock is ahead of the test clock. */
    serverAheadMs?: number;
    dueAtMs?: number;
}

/** Make the envelope that every room session route answers with. */
function envelope(session: Session): Omit<RoomSessionEnvelope, 'status'> {
    const dueAtMs = session.dueAtMs ?? session.startedAtMs + HOUR_MS;
    return {
        success: true,
        server_time: serverTime(Date.now() + (session.serverAheadMs ?? 0)),
        active: true,
        notice: null,
        session: {
            submission_id: '11111111-1111-4111-8111-111111111111',
            room_id: 3,
            room_name: 'Team',
            mission: 'Write',
            target_time_seconds: 7200,
            started_at: serverTime(session.startedAtMs),
            paused_at: session.pausedAtMs === undefined ? null : serverTime(session.pausedAtMs),
            paused_seconds: session.pausedSeconds ?? 0,
            actual_time_seconds: 0,
            state: session.pausedAtMs === undefined ? 'running' : 'paused',
            checkin: { mark: 0, due_at: serverTime(dueAtMs), deadline_at: serverTime(dueAtMs + 300_000), outstanding: false }
        }
    };
}

/** Say that a room session started `startedAgoMs` ago, as an answer that took `roundTripMs`, and show Focus. */
function startRunning(startedAgoMs: number, roundTripMs = 0): void {
    const session = envelope({ startedAtMs: Date.now() - startedAgoMs, serverAheadMs: roundTripMs / 2 });
    applyRoomSessionEnvelope({ ...session, status: 200 }, Date.now(), Date.now() + roundTripMs);
    enterRoomSessionFocus('room');
}

/** Read the number of seconds that Focus shows. */
function shown(): number {
    return roomSessionStore.get().display.actualTimeSeconds;
}

/** Return the real seconds worked, with decimals, as the server's clock sees them now. */
function exactNow(): number {
    const state = roomSessionStore.get();
    return ((state.pausedAtMs ?? getServerNowMs()) - state.startedAtMs) / 1000 - state.pausedSeconds;
}

/** Answer the room session routes with the given envelopes. The functions run when the request arrives. */
function backend(answers: { heartbeat?: () => Omit<RoomSessionEnvelope, 'status'>; pause?: () => Omit<RoomSessionEnvelope, 'status'>; resume?: () => Omit<RoomSessionEnvelope, 'status'> }) {
    return fakeBackendByPath(/** Pick the answer for one request. */ (path): FakeAnswer => {
        const answer = path === 'room-session/heartbeat' ? answers.heartbeat
            : path === 'room-session/pause' ? answers.pause
                : path === 'room-session/resume' ? answers.resume
                    : undefined;
        return answer ? { status: 200, body: answer() } : { status: 500 };
    });
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    screenStore.set({ screen: 'room' });
});

afterEach(() => {
    resetRoomSessionClient();
    vi.useRealTimers();
});

describe('the room timer', () => {
    it('shows each second as it starts, following the server clock', () => {
        startRunning(10_300);
        expect(shown()).toBe(10);
        vi.advanceTimersByTime(700);
        expect(shown()).toBe(10);
        vi.advanceTimersByTime(20);
        expect(shown()).toBe(11);
    });

    it('stays with the clock for a whole minute, at every moment', () => {
        startRunning(300);
        for (let step = 0; step < 1200; step += 1) {
            vi.advanceTimersByTime(50);
            const exact = exactNow();
            const inMargin = exact - Math.floor(exact) < 0.006;
            if (!inMargin) expect(shown()).toBe(Math.floor(exact));
        }
    });

    it('stops ticking while paused and shows the time of the pause', async () => {
        startRunning(10_300);
        backend({ pause: () => envelope({ startedAtMs: NOW - 10_300, pausedAtMs: Date.now() }) });
        await handleRoomPauseResume();
        const atPause = shown();
        vi.advanceTimersByTime(30_000);
        expect(shown()).toBe(atPause);
        expect(roomSessionStore.get().tickTimer).toBeNull();
    });

    it('changes at the real second after a pause and resume with a fractional length', async () => {
        startRunning(0);
        vi.advanceTimersByTime(10_400);
        backend({
            pause: () => envelope({ startedAtMs: NOW, pausedAtMs: NOW + 10_400 }),
            resume: () => envelope({ startedAtMs: NOW, pausedSeconds: 0.3 })
        });
        await handleRoomPauseResume();
        vi.advanceTimersByTime(300);
        await handleRoomPauseResume();
        expect(roomSessionStore.get().pausedSeconds).toBeCloseTo(0.3, 1);
        vi.advanceTimersByTime(590);
        expect(shown()).toBe(10);
        vi.advanceTimersByTime(20);
        expect(shown()).toBe(11);
    });
});

describe('a heartbeat', () => {
    it('does not make the number stall or skip, even when it moves the clock a little', async () => {
        backend({ heartbeat: () => envelope({ startedAtMs: NOW - 300, serverAheadMs: 100 }) });
        startRunning(300, 40);
        const samples: { atMs: number; value: number }[] = [];
        for (let step = 0; step < 800; step += 1) {
            vi.advanceTimersByTime(50);
            await vi.advanceTimersByTimeAsync(0);
            samples.push({ atMs: step * 50, value: shown() });
        }
        const runs: { value: number; lastMs: number; firstMs: number }[] = [];
        for (const sample of samples) {
            const last = runs.at(-1);
            if (last?.value === sample.value) last.lastMs = sample.atMs;
            else runs.push({ value: sample.value, firstMs: sample.atMs, lastMs: sample.atMs });
        }
        const inside = runs.slice(1, -1);
        for (const [index, run] of inside.entries()) {
            expect(run.lastMs - run.firstMs + 50).toBeGreaterThanOrEqual(800);
            expect(run.lastMs - run.firstMs + 50).toBeLessThanOrEqual(1150);
            expect(run.value - (runs[index]?.value ?? run.value)).toBe(1);
        }
        expect(roomSessionStore.get().clockOffsetMs).toBeCloseTo(100, 0);
    });
});

describe('the Review screen', () => {
    it('shows the time the server will save, once the server has answered the pause', async () => {
        startRunning(10_700);
        vi.advanceTimersByTime(100);
        backend({ pause: () => envelope({ startedAtMs: NOW - 10_700, pausedAtMs: Date.now() + 300 }) });
        const stopping = handleRoomStop();
        expect(getCurrentScreenName()).toBe('review');
        expect(shown()).toBe(10);
        await stopping;
        expect(shown()).toBe(11);
        expect(getCurrentScreenName()).toBe('review');
    });
});

describe('a tab that was hidden', () => {
    it('shows the right time at once when the tab is visible again', () => {
        startRunning(1000);
        vi.setSystemTime(new Date(NOW + 600_000));
        expect(shown()).toBeLessThan(5);
        handleRoomTabVisible();
        expect(shown()).toBe(601);
    });

    it('keeps counting after that, in step with the clock', () => {
        startRunning(1000);
        vi.setSystemTime(new Date(NOW + 600_000));
        handleRoomTabVisible();
        vi.advanceTimersByTime(1100);
        expect(shown()).toBe(602);
    });

    it('opens the check-in popup that the browser was late to open', () => {
        startRunning(1000);
        expect(roomSessionStore.get().checkinOpen).toBe(false);
        vi.setSystemTime(new Date(NOW + HOUR_MS + 60_000));
        handleRoomTabVisible();
        expect(roomSessionStore.get().checkinOpen).toBe(true);
    });

    it('does nothing when there is no room session', () => {
        handleRoomTabVisible();
        expect(vi.getTimerCount()).toBe(0);
        expect(roomSessionStore.get().active).toBe(false);
    });
});

describe('cleaning up', () => {
    it('leaves no timer running after the session is reset', () => {
        startRunning(1000);
        resetRoomSessionClient();
        expect(vi.getTimerCount()).toBe(0);
    });
});
