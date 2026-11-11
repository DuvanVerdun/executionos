import { createStore } from '../lib/store';
import type { DisplaySession } from '../types/session';

export interface RoomSessionState {
    active: boolean;
    submissionId: string;
    roomId: number | null;
    roomName: string;
    isPaused: boolean;
    startedAtMs: number;
    pausedAtMs: number | null;
    pausedSeconds: number;
    checkin: { dueAtMs: number | null; deadlineAtMs: number | null; outstanding: boolean };
    clockOffsetMs: number;
    display: DisplaySession;
    /** True while a server-confirmed request (Finish) is in flight. */
    isBusy: boolean;
    /** Grows when the session is reset, so late answers can be ignored. */
    generation: number;
    pending: number;
    queueTail: Promise<unknown>;
    eventCounter: number;
    heartbeatInFlight: boolean;
    finishFailed: boolean;
    countdownRefreshed: boolean;
    /** The check-in popup: whether it shows, and its countdown text. */
    checkinOpen: boolean;
    checkinCountdown: string;
    tickTimer: ReturnType<typeof setTimeout> | null;
    heartbeatTimer: ReturnType<typeof setInterval> | null;
    checkinTimer: ReturnType<typeof setTimeout> | null;
    countdownTimer: ReturnType<typeof setInterval> | null;
}

/** Create the empty client state of a room session. */
export function createInitialRoomSessionState(): RoomSessionState {
    return {
        active: false,
        submissionId: '',
        roomId: null,
        roomName: '',
        isPaused: false,
        startedAtMs: 0,
        pausedAtMs: null,
        pausedSeconds: 0,
        checkin: { dueAtMs: null, deadlineAtMs: null, outstanding: false },
        clockOffsetMs: 0,
        display: {
            currentMission: '',
            targetTimeSeconds: 0,
            actualTimeSeconds: 0,
            completionStatus: 'partial',
            percentageCompleted: 0
        },
        isBusy: false,
        generation: 0,
        pending: 0,
        queueTail: Promise.resolve(),
        eventCounter: 0,
        heartbeatInFlight: false,
        finishFailed: false,
        countdownRefreshed: false,
        checkinOpen: false,
        checkinCountdown: '',
        tickTimer: null,
        heartbeatTimer: null,
        checkinTimer: null,
        countdownTimer: null
    };
}

export const roomSessionStore = createStore<RoomSessionState>(createInitialRoomSessionState());

/** Merge a patch into the display values of the running room session. */
export function patchRoomDisplay(patch: Partial<DisplaySession>): void {
    const state = roomSessionStore.get();
    roomSessionStore.update({ display: { ...state.display, ...patch } });
}
