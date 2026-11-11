import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentScreenName, screenStore } from '../shared/navigation';
import { fakeBackendByPath, jsonBodyOf, pathOf, type FakeAnswer } from '../test/network';
import type { RoomSessionEnvelope } from '../types/rooms';
import {
    applyRoomSessionEnvelope,
    enterRoomSessionFocus,
    handleCheckinConfirm,
    handleRoomContinue,
    handleRoomFinish,
    handleRoomPauseResume,
    handleRoomStop,
    handleRoomTabVisible,
    resetRoomSessionClient,
    startRoomWork
} from './room-session';
import { roomSessionStore } from './room-session-state';
import { roomStore } from './state';

const NOW = new Date('2026-11-09T12:00:00Z').getTime();
const HOUR_MS = 3_600_000;

/** Write a moment the way the server does: UTC, without the Z. */
function serverTime(ms: number): string {
    return new Date(ms).toISOString().replace('Z', '');
}

/**
 * What the fake server believes about the session. Its own moments are far from this device's clock on purpose,
 * to prove that the device ignores them.
 */
const server = { state: 'running' as 'running' | 'paused', mark: 1, actualSeconds: 0, acceptCheckin: true };

/** Make the envelope that every room session route answers with. */
function envelope(): Omit<RoomSessionEnvelope, 'status'> {
    return {
        success: true,
        server_time: serverTime(Date.now() + 5_000_000),
        active: true,
        notice: null,
        session: {
            submission_id: '11111111-1111-4111-8111-111111111111',
            room_id: 3,
            room_name: 'Team',
            mission: 'Write',
            target_time_seconds: 7200,
            started_at: serverTime(NOW - 99_000_000),
            paused_at: server.state === 'paused' ? serverTime(NOW - 98_000_000) : null,
            paused_seconds: 4242,
            actual_time_seconds: server.actualSeconds,
            state: server.state,
            checkin: { mark: server.mark, due_at: serverTime(NOW + 777), deadline_at: serverTime(NOW + 888), outstanding: false }
        }
    };
}

/** Make the fake server answer the room session routes, and keep the requests it gets. */
function startFakeServer() {
    return fakeBackendByPath(/** Pick the answer for one request. */ (path): FakeAnswer => {
        if (path === 'room-session/pause') server.state = 'paused';
        if (path === 'room-session/resume') server.state = 'running';
        if (path === 'room-session/checkin' && server.acceptCheckin) server.mark += 1;
        if (path === 'room-session/finish') {
            return { status: 200, body: { ...envelope(), active: false, session: null, saved: true, session_id: 7 } };
        }
        return path.startsWith('room-session') ? { status: 200, body: envelope() } : { status: 500 };
    });
}

type FakeServer = ReturnType<typeof startFakeServer>;

/** Return the body of every request that was sent to a room session route. */
function bodiesOf(fake: FakeServer, route: string): Record<string, unknown>[] {
    return fake.mock.calls
        .filter(/** Keep the requests for this route. */ ([url]) => pathOf(url) === route)
        .map(/** Read the body of one request. */ ([, init]) => jsonBodyOf(init));
}

/** Count the requests that were sent to a room session route. */
function countOf(fake: FakeServer, route: string): number {
    return fake.mock.calls.filter(/** Keep the requests for this route. */ ([url]) => pathOf(url) === route).length;
}

/** Start a room session from the Room screen, the way the Start Work button does, and wait for the server's answer. */
async function startSession(): Promise<void> {
    roomStore.update({ roomId: 3 });
    await startRoomWork('Write', '02:00');
}

/** Read the number of seconds that Focus shows. */
function shown(): number {
    return roomSessionStore.get().display.actualTimeSeconds;
}

/** Return the real seconds worked, with decimals, on this device's clock. */
function exactNow(): number {
    const state = roomSessionStore.get();
    return ((state.pausedAtMs ?? Date.now()) - state.startedAtMs) / 1000 - state.pausedSeconds;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    screenStore.set({ screen: 'room' });
    Object.assign(server, { state: 'running', mark: 1, actualSeconds: 0, acceptCheckin: true });
});

afterEach(() => {
    resetRoomSessionClient();
    vi.useRealTimers();
});

describe('the room timer is counted on this device', () => {
    it('starts counting at the click, and ignores the moments the server reports', async () => {
        startFakeServer();
        await startSession();
        expect(roomSessionStore.get().startedAtMs).toBe(NOW);
        expect(shown()).toBe(0);
        vi.advanceTimersByTime(3500);
        expect(shown()).toBe(3);
    });

    it('does not change the time when a heartbeat answer has other numbers', async () => {
        startFakeServer();
        await startSession();
        server.actualSeconds = 5000;
        await vi.advanceTimersByTimeAsync(15_500);
        expect(shown()).toBe(15);
    });

    it('shows each second as it starts', async () => {
        startFakeServer();
        await startSession();
        vi.advanceTimersByTime(1004);
        expect(shown()).toBe(0);
        vi.advanceTimersByTime(2);
        expect(shown()).toBe(1);
    });

    it('stays with the clock for a whole minute, at every moment', async () => {
        startFakeServer();
        await startSession();
        for (let step = 0; step < 1200; step += 1) {
            await vi.advanceTimersByTimeAsync(50);
            const exact = exactNow();
            if (exact - Math.floor(exact) >= 0.006) expect(shown()).toBe(Math.floor(exact));
        }
    });

    it('does not stall or skip when a heartbeat answer arrives', async () => {
        startFakeServer();
        await startSession();
        const samples: { atMs: number; value: number }[] = [];
        for (let step = 0; step < 800; step += 1) {
            await vi.advanceTimersByTimeAsync(50);
            samples.push({ atMs: step * 50, value: shown() });
        }
        const runs: { value: number; firstMs: number; lastMs: number }[] = [];
        for (const sample of samples) {
            const last = runs.at(-1);
            if (last?.value === sample.value) last.lastMs = sample.atMs;
            else runs.push({ value: sample.value, firstMs: sample.atMs, lastMs: sample.atMs });
        }
        for (const [index, run] of runs.slice(1, -1).entries()) {
            expect(run.lastMs - run.firstMs + 50).toBeGreaterThanOrEqual(900);
            expect(run.lastMs - run.firstMs + 50).toBeLessThanOrEqual(1100);
            expect(run.value - (runs[index]?.value ?? run.value)).toBe(1);
        }
    });
});

describe('pause and resume', () => {
    it('freezes the number and sends the seconds counted at the click', async () => {
        const fake = startFakeServer();
        await startSession();
        vi.advanceTimersByTime(10_300);
        await handleRoomPauseResume();
        expect(shown()).toBe(10);
        vi.advanceTimersByTime(30_000);
        expect(shown()).toBe(10);
        expect(roomSessionStore.get().tickTimer).toBeNull();
        expect(bodiesOf(fake, 'room-session/pause')).toEqual([{ workedSeconds: 10 }]);
    });

    it('sends the seconds counted at the click, even when the request is sent later', async () => {
        const fake = startFakeServer();
        await startSession();
        vi.advanceTimersByTime(10_300);
        const pausing = handleRoomPauseResume();
        vi.advanceTimersByTime(5000);
        await pausing;
        expect(bodiesOf(fake, 'room-session/pause')[0]).toEqual({ workedSeconds: 10 });
    });

    it('sends nothing but the event when it resumes, and does not count the paused time', async () => {
        const fake = startFakeServer();
        await startSession();
        vi.advanceTimersByTime(10_400);
        await handleRoomPauseResume();
        vi.advanceTimersByTime(20_000);
        await handleRoomPauseResume();
        expect(bodiesOf(fake, 'room-session/resume')).toEqual([{}]);
        expect(roomSessionStore.get().pausedSeconds).toBeCloseTo(20, 3);
        vi.advanceTimersByTime(5500);
        expect(shown()).toBe(15);
    });

    it('changes at the real second after a pause with a fractional length', async () => {
        startFakeServer();
        await startSession();
        vi.advanceTimersByTime(10_400);
        await handleRoomPauseResume();
        vi.advanceTimersByTime(300);
        await handleRoomPauseResume();
        vi.advanceTimersByTime(590);
        expect(shown()).toBe(10);
        vi.advanceTimersByTime(20);
        expect(shown()).toBe(11);
    });

    it('keeps the number and the requests right through many quick toggles', async () => {
        const fake = startFakeServer();
        await startSession();
        vi.advanceTimersByTime(10_000);
        let runningMs = 10_000;
        const expectedPauses: number[] = [];
        for (let round = 0; round < 6; round += 1) {
            await handleRoomPauseResume();
            expect(shown()).toBe(Math.floor(runningMs / 1000));
            expectedPauses.push(Math.floor(runningMs / 1000));
            vi.advanceTimersByTime(500);
            await handleRoomPauseResume();
            vi.advanceTimersByTime(500);
            runningMs += 500;
        }
        expect(bodiesOf(fake, 'room-session/pause').map(/** Read the seconds of a pause. */ (body) => body.workedSeconds)).toEqual(expectedPauses);
        expect(countOf(fake, 'room-session/resume')).toBe(6);
    });
});

describe('stop, continue and finish', () => {
    it('shows Review with the number that was sent to the server', async () => {
        const fake = startFakeServer();
        await startSession();
        vi.advanceTimersByTime(10_700);
        server.actualSeconds = 999;
        await handleRoomStop();
        expect(getCurrentScreenName()).toBe('review');
        expect(shown()).toBe(10);
        expect(bodiesOf(fake, 'room-session/pause')).toEqual([{ workedSeconds: 10 }]);
    });

    it('sends no pause when Stop is pressed while paused', async () => {
        const fake = startFakeServer();
        await startSession();
        vi.advanceTimersByTime(10_000);
        await handleRoomPauseResume();
        await handleRoomStop();
        expect(getCurrentScreenName()).toBe('review');
        expect(countOf(fake, 'room-session/pause')).toBe(1);
    });

    it('counts the time on Review as paused when the user continues', async () => {
        const fake = startFakeServer();
        await startSession();
        vi.advanceTimersByTime(10_000);
        await handleRoomStop();
        vi.advanceTimersByTime(60_000);
        await handleRoomContinue();
        expect(getCurrentScreenName()).toBe('focus');
        expect(shown()).toBe(10);
        vi.advanceTimersByTime(2500);
        expect(shown()).toBe(12);
        expect(countOf(fake, 'room-session/resume')).toBe(1);
    });

    it('finishes with the seconds that Review showed, and returns to the room', async () => {
        const fake = startFakeServer();
        await startSession();
        vi.advanceTimersByTime(12_300);
        await handleRoomStop();
        server.actualSeconds = 4321;
        const finishing = handleRoomFinish();
        await vi.advanceTimersByTimeAsync(3000);
        await finishing;
        expect(bodiesOf(fake, 'room-session/finish')).toEqual([{ submissionId: '11111111-1111-4111-8111-111111111111', actualSeconds: 12 }]);
        expect(roomSessionStore.get().active).toBe(false);
        expect(getCurrentScreenName()).toBe('room');
    });

    it('follows the exact flow: start, pause, resume, pause, stop, continue, stop, finish', async () => {
        const fake = startFakeServer();
        await startSession();
        vi.advanceTimersByTime(10_300);
        await handleRoomPauseResume();
        vi.advanceTimersByTime(2000);
        await handleRoomPauseResume();
        vi.advanceTimersByTime(5200);
        await handleRoomPauseResume();
        await handleRoomStop();
        vi.advanceTimersByTime(4000);
        await handleRoomContinue();
        vi.advanceTimersByTime(3000);
        await handleRoomStop();
        const worked = shown();
        const finishing = handleRoomFinish();
        await vi.advanceTimersByTimeAsync(3000);
        await finishing;
        expect(worked).toBe(18);
        expect(bodiesOf(fake, 'room-session/pause').map(/** Read the seconds of a pause. */ (body) => body.workedSeconds)).toEqual([10, 15, 18]);
        expect(bodiesOf(fake, 'room-session/finish')[0]?.actualSeconds).toBe(18);
        expect(countOf(fake, 'room-session/resume')).toBe(2);
    });
});

describe('the check-in', () => {
    it('opens when the time worked reaches the hour, not when the server says', async () => {
        startFakeServer();
        await startSession();
        await vi.advanceTimersByTimeAsync(3_500_000);
        await handleRoomPauseResume();
        await vi.advanceTimersByTimeAsync(300_000);
        await handleRoomPauseResume();
        await vi.advanceTimersByTimeAsync(99_000);
        expect(roomSessionStore.get().checkinOpen).toBe(false);
        await vi.advanceTimersByTimeAsync(2000);
        expect(roomSessionStore.get().checkinOpen).toBe(true);
    });

    it('counts down from the moment it was due', async () => {
        startFakeServer();
        await startSession();
        await vi.advanceTimersByTimeAsync(HOUR_MS + 60_000);
        expect(roomSessionStore.get().checkinCountdown).toBe('4:00 left to respond');
    });

    it('confirms with the seconds counted, closes the popup, and moves the next check-in an hour of work later', async () => {
        const fake = startFakeServer();
        await startSession();
        await vi.advanceTimersByTimeAsync(HOUR_MS + 5000);
        await handleCheckinConfirm();
        expect(roomSessionStore.get().checkinOpen).toBe(false);
        expect(roomSessionStore.get().checkinMark).toBe(2);
        expect(bodiesOf(fake, 'room-session/checkin')).toEqual([{ workedSeconds: 3605 }]);
        await vi.advanceTimersByTimeAsync(HOUR_MS - 10_000);
        expect(roomSessionStore.get().checkinOpen).toBe(false);
        await vi.advanceTimersByTimeAsync(10_000);
        expect(roomSessionStore.get().checkinOpen).toBe(true);
    });

    it('asks again when the server did not accept the confirmation', async () => {
        startFakeServer();
        await startSession();
        await vi.advanceTimersByTimeAsync(HOUR_MS + 5000);
        server.acceptCheckin = false;
        await handleCheckinConfirm();
        expect(roomSessionStore.get().checkinMark).toBe(1);
        expect(roomSessionStore.get().checkinOpen).toBe(true);
    });
});

describe('a session that this device does not know yet', () => {
    it('continues from the time the server counted, for example after a reload', () => {
        server.actualSeconds = 1234;
        applyRoomSessionEnvelope({ ...envelope(), status: 200 });
        enterRoomSessionFocus('loading');
        expect(shown()).toBe(1234);
        vi.advanceTimersByTime(2500);
        expect(shown()).toBe(1236);
    });

    it('restores a paused session frozen at the time the server kept', () => {
        server.state = 'paused';
        server.actualSeconds = 1234;
        applyRoomSessionEnvelope({ ...envelope(), status: 200 });
        enterRoomSessionFocus('loading');
        vi.advanceTimersByTime(30_000);
        expect(shown()).toBe(1234);
        expect(roomSessionStore.get().isPaused).toBe(true);
    });

    it('opens the check-in at once when it was already due', () => {
        server.actualSeconds = HOUR_MS / 1000 + 50;
        applyRoomSessionEnvelope({ ...envelope(), status: 200 });
        enterRoomSessionFocus('loading');
        expect(roomSessionStore.get().checkinOpen).toBe(true);
        expect(roomSessionStore.get().checkin.deadlineAtMs).toBe(NOW + 250_000);
    });

    it('takes the room name from the server, so a rename shows', async () => {
        startFakeServer();
        await startSession();
        applyRoomSessionEnvelope({ ...envelope(), status: 200, session: { ...envelope().session, room_name: 'Renamed' } as RoomSessionEnvelope['session'] });
        expect(roomSessionStore.get().roomName).toBe('Renamed');
    });
});

describe('when the server and this device disagree about the state', () => {
    it('pauses when the server says it is paused', async () => {
        startFakeServer();
        await startSession();
        vi.advanceTimersByTime(5500);
        server.state = 'paused';
        applyRoomSessionEnvelope({ ...envelope(), status: 200 });
        expect(roomSessionStore.get().isPaused).toBe(true);
        expect(shown()).toBe(5);
    });

    it('resumes when the server says it is running', async () => {
        startFakeServer();
        await startSession();
        await handleRoomPauseResume();
        server.state = 'running';
        applyRoomSessionEnvelope({ ...envelope(), status: 200 });
        expect(roomSessionStore.get().isPaused).toBe(false);
    });
});

describe('a tab that was hidden', () => {
    it('shows the right time at once when the tab is visible again, and keeps counting', async () => {
        startFakeServer();
        await startSession();
        vi.setSystemTime(new Date(NOW + 600_000));
        expect(shown()).toBeLessThan(5);
        handleRoomTabVisible();
        expect(shown()).toBe(600);
        vi.advanceTimersByTime(1100);
        expect(shown()).toBe(601);
    });

    it('opens the check-in popup that the browser was late to open', async () => {
        startFakeServer();
        await startSession();
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
    it('leaves no timer running after the session is reset', async () => {
        startFakeServer();
        await startSession();
        resetRoomSessionClient();
        expect(vi.getTimerCount()).toBe(0);
    });
});
