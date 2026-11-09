// Rooms, Room, running room session and modal state.

export const roomsState = {
    rooms: [],
    hasLoaded: false,
    isLoading: false,
    loadGeneration: 0,
    pollTimer: null,
    openMenuRoomId: null,
    renderDeferred: false,
    busyAction: null
};

export const roomState = {
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

export const roomSnapshotCache = new Map();

/** Create the empty client state of a room session. */
export function createInitialRoomSessionState() {
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

export const roomSessionState = createInitialRoomSessionState();

export const checkinAudio = {
    context: null,
    buffer: null,
    loading: null,
    source: null,
    failed: false
};

export const modalState = {
    openOverlay: null,
    returnFocus: null,
    isSubmitting: false,
    roomLink: ''
};
