import { ROOM_POLL_INTERVAL_MS } from '../config';
import { t } from '../i18n/i18n';
import { navigateTo } from '../shared/navigation';
import type { HistoryFailure, RoomMenuHooks } from '../types/rooms';
import type { ScreenName } from '../types/screens';
import { fetchRoomSessions, fetchRoomSnapshot } from './api';
import { enterRoomsScreen } from './rooms';
import { roomSnapshotCache, roomStore, type RoomView } from './state';

/** Grows with every load and every screen exit, so older results can be ignored. */
let loadGeneration = 0;

let historyGeneration = 0;

let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Open or close the top bar menu. */
export function setRoomMenuState(open: boolean): void {
    roomStore.update({ menuOpen: open });
}

/** Show one Room surface (loading, ready, error, or unavailable) and hide the others. */
function showRoomView(view: RoomView): void {
    roomStore.update({ view });
    if (view !== 'ready') setRoomMenuState(false);
}

/** Show a history failure with its Retry button. */
function showRoomHistoryFailure(kind: HistoryFailure): void {
    roomStore.update({
        historyFailure: kind,
        historyMessage: kind === 'first' ? t('rooms.historyFailed') : t('common.moreSessionsFailed')
    });
}

/** Load the first page of the room history. */
async function loadRoomHistory(): Promise<void> {
    const roomId = roomStore.get().roomId;
    if (roomId === null) return;
    const generation = ++historyGeneration;
    roomStore.update({ isLoadingMore: false, historyFailure: null, historyMessage: '' });

    try {
        const result = await fetchRoomSessions(roomId);
        if (generation !== historyGeneration) return;
        if (result.status === 404) {
            showUnavailableRoom();
            return;
        }
        if (!result.success) throw new Error(result.error);
        roomStore.update({
            sessions: result.sessions,
            dailySummaries: result.daily_summaries,
            nextCursor: result.next_cursor,
            historyLoaded: true
        });
    } catch (error) {
        if (generation !== historyGeneration) return;
        console.error('Room history loading error:', error);
        showRoomHistoryFailure('first');
    }
}

/** Load and append the next page of the room history. */
export async function loadMoreRoomSessions(): Promise<void> {
    const state = roomStore.get();
    const roomId = state.roomId;
    if (roomId === null) return;
    if (state.isLoading || state.isLoadingMore || state.historyFailure || !state.nextCursor) return;
    const generation = historyGeneration;
    roomStore.update({ isLoadingMore: true, historyMessage: t('common.loadingMore') });

    try {
        const result = await fetchRoomSessions(roomId, state.nextCursor);
        if (generation !== historyGeneration) return;
        if (!result.success) throw new Error(result.error);
        const current = roomStore.get();
        roomStore.update({
            sessions: [...current.sessions, ...result.sessions],
            dailySummaries: { ...current.dailySummaries, ...result.daily_summaries },
            nextCursor: result.next_cursor,
            historyMessage: ''
        });
    } catch (error) {
        if (generation !== historyGeneration) return;
        console.error('Room history pagination error:', error);
        showRoomHistoryFailure('more');
    } finally {
        if (generation === historyGeneration) {
            roomStore.update({ isLoadingMore: false });
        }
    }
}

/** Retry the failed history request. */
export async function handleRoomHistoryRetry(): Promise<void> {
    const state = roomStore.get();
    if (state.isLoadingMore) return;
    if (state.historyFailure === 'first') {
        await loadRoomHistory();
        return;
    }
    roomStore.update({ historyFailure: null });
    await loadMoreRoomSessions();
}

/** Show a new mission on a session of the room history. The server has already saved it, and no total depends on it. */
export function setRoomSessionMission(sessionId: number, mission: string): void {
    roomStore.update({
        sessions: roomStore.get().sessions.map(/** Change the mission of the matching session. */ (session) => (
            session.id === sessionId ? { ...session, mission } : session
        ))
    });
}

/** Load the room snapshot, and the history when it is needed. */
export async function loadRoom(
    { silent = false, reloadHistory = false, surfaceErrors = !silent }: { silent?: boolean; reloadHistory?: boolean; surfaceErrors?: boolean } = {}
): Promise<void> {
    const roomId = roomStore.get().roomId;
    if (roomId === null) return;
    const generation = ++loadGeneration;
    roomStore.update({ isLoading: true });
    if (!silent) showRoomView('loading');

    try {
        const result = await fetchRoomSnapshot(roomId);
        if (generation !== loadGeneration) return;
        if (result.status === 404) {
            showUnavailableRoom();
            return;
        }
        if (!result.success) throw new Error(result.error);
        const previousTotal = roomStore.get().snapshot?.summary.total_sessions;
        const snapshot = { room: result.room, summary: result.summary, ranking: result.ranking };
        roomStore.update({ snapshot });
        roomSnapshotCache.set(roomId, snapshot);
        showRoomView('ready');
        const totalChanged = previousTotal !== undefined && previousTotal !== result.summary.total_sessions;
        if (reloadHistory || !roomStore.get().historyLoaded || totalChanged) await loadRoomHistory();
    } catch (error) {
        if (generation !== loadGeneration) return;
        console.error('Room loading error:', error);
        if (surfaceErrors || !roomStore.get().snapshot) showRoomView('error');
    } finally {
        if (generation === loadGeneration) roomStore.update({ isLoading: false });
    }
}

/** Refresh the room on a timer, skipping hidden tabs and overlapping requests. */
export async function pollRoom(): Promise<void> {
    if (document.hidden || roomStore.get().isLoading) return;
    await loadRoom({ silent: true });
}

/** Whether the room is being polled now. */
export function isPollingRoom(): boolean {
    return pollTimer !== null;
}

/** Start polling the room every 15 seconds. */
export function startRoomPolling(): void {
    stopRoomPolling();
    pollTimer = setInterval(pollRoom, ROOM_POLL_INTERVAL_MS);
}

/** Stop polling the room. */
function stopRoomPolling(): void {
    clearInterval(pollTimer ?? undefined);
    pollTimer = null;
}

/** Forget the previous room and prepare a clean Room screen. */
function resetRoomState(roomId: number | null): void {
    stopRoomPolling();
    loadGeneration += 1;
    historyGeneration += 1;
    roomStore.update({
        roomId,
        snapshot: null,
        sessions: [],
        dailySummaries: {},
        nextCursor: null,
        historyLoaded: false,
        historyFailure: null,
        historyMessage: '',
        isLoading: false,
        isLoadingMore: false,
        busyAction: null
    });
    showRoomView('loading');
}

/** Stop everything the Room screen started. */
export function leaveRoomScreen(): void {
    stopRoomPolling();
    loadGeneration += 1;
    historyGeneration += 1;
    roomStore.update({ isLoading: false });
    setRoomMenuState(false);
}

/** Open a room from another screen and load it. */
export async function openRoom(roomId: number, currentScreen: ScreenName): Promise<void> {
    resetRoomState(roomId);
    const cached = roomSnapshotCache.get(roomId);
    if (cached) {
        roomStore.update({ snapshot: cached });
        showRoomView('ready');
    }
    navigateTo('room', currentScreen);
    startRoomPolling();
    await loadRoom({ silent: Boolean(cached), reloadHistory: Boolean(cached), surfaceErrors: true });
}

/** Show the "This room isn't available" state, from the Room screen or another one. */
export function showUnavailableRoom(currentScreen: ScreenName | null = null): void {
    if (currentScreen !== null) {
        resetRoomState(null);
        navigateTo('room', currentScreen);
    }
    stopRoomPolling();
    showRoomView('unavailable');
}

/** Go back to the Rooms screen. */
export async function handleRoomBack(): Promise<void> {
    navigateTo('rooms', 'room');
    await enterRoomsScreen();
}

/** Retry loading the room after a failed first load. */
export async function retryRoom(): Promise<void> {
    await loadRoom();
}

/** What the Room screen tells the room menu. */
export const roomMenuHooks: RoomMenuHooks = {
    screen: 'room',
    /** Report whether a Room menu action is running. */
    isBusy: () => roomStore.get().busyAction !== null,
    /** Record the running Room menu action. */
    setBusy(action) {
        roomStore.update({ busyAction: action });
    },
    /** Change the show-missions setting of the open room. */
    setShowMissions(_roomId, value) {
        const snapshot = roomStore.get().snapshot;
        if (!snapshot) return;
        const updated = { ...snapshot, room: { ...snapshot.room, show_missions: value } };
        roomStore.update({ snapshot: updated });
        roomSnapshotCache.set(updated.room.id, updated);
    },
    /** Return to Rooms after the room is left or deleted. */
    async onRemoved() {
        setRoomMenuState(false);
        await handleRoomBack();
    }
};
