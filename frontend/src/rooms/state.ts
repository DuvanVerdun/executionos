// Rooms, Room, running room session and modal state.

import type { DisplaySession, DailySummary, HistoryCursor } from '../types/session';
import type {
    HistoryFailure, RoomCard, RoomHistorySession, RoomMenuAction, RoomSnapshot
} from '../types/rooms';

interface RoomsState {
    rooms: RoomCard[];
    hasLoaded: boolean;
    isLoading: boolean;
    /** Grows with every load, so older results can be ignored. */
    loadGeneration: number;
    pollTimer: ReturnType<typeof setInterval> | null;
    openMenuRoomId: number | null;
    renderDeferred: boolean;
    busyAction: RoomMenuAction | null;
}

interface RoomState {
    roomId: number | null;
    snapshot: RoomSnapshot | null;
    sessions: RoomHistorySession[];
    dailySummaries: Record<string, DailySummary>;
    nextCursor: HistoryCursor | null;
    historyLoaded: boolean;
    historyFailure: HistoryFailure | null;
    isLoading: boolean;
    isLoadingMore: boolean;
    loadGeneration: number;
    historyGeneration: number;
    pollTimer: ReturnType<typeof setInterval> | null;
    historyObserver: IntersectionObserver | null;
    menuOpen: boolean;
    busyAction: RoomMenuAction | null;
}

/** What the client knows about the room session it is running. Times are on the server's clock. */
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
    isBusy: boolean;
    busyButton: HTMLButtonElement | null;
    restoreLabel: string;
    /** Grows when the session is reset, so late answers can be ignored. */
    generation: number;
    pending: number;
    queueTail: Promise<unknown>;
    eventCounter: number;
    heartbeatInFlight: boolean;
    finishFailed: boolean;
    countdownRefreshed: boolean;
    tickTimer: ReturnType<typeof setInterval> | null;
    heartbeatTimer: ReturnType<typeof setInterval> | null;
    checkinTimer: ReturnType<typeof setTimeout> | null;
    countdownTimer: ReturnType<typeof setInterval> | null;
}

interface CheckinAudio {
    context: AudioContext | null;
    buffer: AudioBuffer | null;
    loading: Promise<void> | null;
    source: AudioBufferSourceNode | null;
    failed: boolean;
}

interface ModalState {
    openOverlay: HTMLElement | null;
    returnFocus: HTMLElement | null;
    isSubmitting: boolean;
    roomLink: string;
}

export const roomsState: RoomsState = {
    rooms: [],
    hasLoaded: false,
    isLoading: false,
    loadGeneration: 0,
    pollTimer: null,
    openMenuRoomId: null,
    renderDeferred: false,
    busyAction: null
};

export const roomState: RoomState = {
    roomId: null,
    snapshot: null,
    sessions: [],
    dailySummaries: {},
    nextCursor: null,
    historyLoaded: false,
    historyFailure: null,
    isLoading: false,
    isLoadingMore: false,
    loadGeneration: 0,
    historyGeneration: 0,
    pollTimer: null,
    historyObserver: null,
    menuOpen: false,
    busyAction: null
};

export const roomSnapshotCache = new Map<number, RoomSnapshot>();

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
        busyButton: null,
        restoreLabel: '',
        generation: 0,
        pending: 0,
        queueTail: Promise.resolve(),
        eventCounter: 0,
        heartbeatInFlight: false,
        finishFailed: false,
        countdownRefreshed: false,
        tickTimer: null,
        heartbeatTimer: null,
        checkinTimer: null,
        countdownTimer: null
    };
}

export const roomSessionState: RoomSessionState = createInitialRoomSessionState();

export const checkinAudio: CheckinAudio = {
    context: null,
    buffer: null,
    loading: null,
    source: null,
    failed: false
};

export const modalState: ModalState = {
    openOverlay: null,
    returnFocus: null,
    isSubmitting: false,
    roomLink: ''
};
