import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../auth/state';
import { HEARTBEAT_INTERVAL_MS } from '../config';
import { createInitialRoomSessionState, roomSessionStore } from '../rooms/room-session-state';
import { createEmptyActiveSession, sessionStore, updateActiveSession } from '../session/state';
import { fakeBackendByPath, jsonBodyOf, pathOf } from '../test/network';
import { currentReport, startPresenceReporting, stopPresenceReporting } from './presence';

/** Return the requests the fake backend got, as "METHOD path" with their bodies. */
function sent(fake: ReturnType<typeof fakeBackendByPath>): [string, Record<string, unknown>][] {
    return fake.mock.calls.map(/** Describe one request. */ ([url, init]) => [
        `${init?.method ?? 'GET'} ${pathOf(url)}`,
        jsonBodyOf(init)
    ]);
}

/** Start a personal session that runs. */
function startPersonalSession(overrides: Partial<ReturnType<typeof createEmptyActiveSession>> = {}): void {
    updateActiveSession({
        currentMission: 'write tests', targetTimeSeconds: 3600, actualTimeSeconds: 0,
        startTimestamp: '2026-11-16T10:00:00.000Z', isTimerRunning: true, ...overrides
    });
}

let fake: ReturnType<typeof fakeBackendByPath>;

beforeEach(() => {
    vi.useFakeTimers();
    authStore.update({ accessToken: 'token', userId: 1, username: 'duvan' });
    fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
    startPresenceReporting();
});

afterEach(() => {
    stopPresenceReporting();
    vi.useRealTimers();
});

describe('the report of a session', () => {
    it('is nothing while the user is not in a session', () => {
        expect(currentReport()).toBeNull();
    });

    it('describes a running personal session, and a paused one', () => {
        startPersonalSession({ actualTimeSeconds: 90 });
        expect(currentReport()).toEqual({ state: 'working', mission: 'write tests', workedSeconds: 90, targetSeconds: 3600 });
        updateActiveSession({ isTimerRunning: false });
        expect(currentReport()?.state).toBe('paused');
    });

    it('describes a room session with its own time, and Review counts as paused', () => {
        roomSessionStore.update({
            active: true, isPaused: true,
            display: { currentMission: 'in the room', targetTimeSeconds: 1800, actualTimeSeconds: 600, completionStatus: 'partial', percentageCompleted: 33 }
        });
        expect(currentReport()).toEqual({ state: 'paused', mission: 'in the room', workedSeconds: 600, targetSeconds: 1800 });
    });

    it('prefers the room session when both exist', () => {
        startPersonalSession();
        roomSessionStore.update({
            active: true,
            display: { currentMission: 'in the room', targetTimeSeconds: 1800, actualTimeSeconds: 0, completionStatus: 'partial', percentageCompleted: 0 }
        });
        expect(currentReport()?.mission).toBe('in the room');
    });
});

describe('reporting to the server', () => {
    it('says nothing while there is no session', async () => {
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
        expect(fake).not.toHaveBeenCalled();
    });

    it('reports when a session starts, and again when its state changes', async () => {
        startPersonalSession();
        await vi.advanceTimersByTimeAsync(0);
        updateActiveSession({ isTimerRunning: false, actualTimeSeconds: 120 });
        await vi.advanceTimersByTimeAsync(0);
        expect(sent(fake)).toEqual([
            ['PUT presence', { state: 'working', mission: 'write tests', workedSeconds: 0, targetSeconds: 3600 }],
            ['PUT presence', { state: 'paused', mission: 'write tests', workedSeconds: 120, targetSeconds: 3600 }]
        ]);
    });

    it('does not report every second of the timer, only the heartbeat repeats it with the time worked', async () => {
        startPersonalSession();
        await vi.advanceTimersByTimeAsync(0);
        updateActiveSession({ actualTimeSeconds: 5 });
        updateActiveSession({ actualTimeSeconds: 6 });
        await vi.advanceTimersByTimeAsync(0);
        expect(fake).toHaveBeenCalledTimes(1);
        updateActiveSession({ actualTimeSeconds: 15 });
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
        expect(sent(fake).at(-1)).toEqual(['PUT presence', { state: 'working', mission: 'write tests', workedSeconds: 15, targetSeconds: 3600 }]);
        expect(fake).toHaveBeenCalledTimes(2);
    });

    it('tells the server when the session ends, and stops the heartbeat', async () => {
        startPersonalSession();
        await vi.advanceTimersByTimeAsync(0);
        sessionStore.update({ active: createEmptyActiveSession() });
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
        expect(sent(fake).map(/** Keep the request lines. */ ([line]) => line)).toEqual(['PUT presence', 'DELETE presence']);
    });

    it('reports a room session, and tells the server when it ends', async () => {
        roomSessionStore.update({
            active: true,
            display: { currentMission: 'in the room', targetTimeSeconds: 1800, actualTimeSeconds: 0, completionStatus: 'partial', percentageCompleted: 0 }
        });
        await vi.advanceTimersByTimeAsync(0);
        roomSessionStore.set(createInitialRoomSessionState());
        await vi.advanceTimersByTimeAsync(0);
        expect(sent(fake).map(/** Keep the request lines. */ ([line]) => line)).toEqual(['PUT presence', 'DELETE presence']);
    });

    it('reports a session that was already running when the reporter started', async () => {
        stopPresenceReporting();
        startPersonalSession();
        startPresenceReporting();
        await vi.advanceTimersByTimeAsync(0);
        expect(fake).toHaveBeenCalledTimes(1);
    });

    it('says nothing without a signed-in user, and stops when the user signs out', async () => {
        authStore.update({ accessToken: null, userId: null });
        startPersonalSession();
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2);
        expect(fake).not.toHaveBeenCalled();
        authStore.update({ accessToken: 'token', userId: 1 });
        await vi.advanceTimersByTimeAsync(0);
        expect(fake).toHaveBeenCalledTimes(1);
        authStore.update({ accessToken: null, userId: null });
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
        expect(fake).toHaveBeenCalledTimes(1);
    });
});

describe('when a report fails', () => {
    it('leaves the session alone and keeps reporting', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => Promise.reject(new Error('offline'))));
        startPersonalSession();
        await vi.advanceTimersByTimeAsync(0);
        expect(error).toHaveBeenCalledOnce();
        expect(sessionStore.get().active.isTimerRunning).toBe(true);
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
        expect(error).toHaveBeenCalledTimes(2);
    });
});
