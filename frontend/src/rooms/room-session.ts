import {
    CHECKIN_INTERVAL_MS,
    CHECKIN_RESPONSE_MS,
    HEARTBEAT_INTERVAL_MS,
    ROOM_RETRY_DELAY_MS,
    ROOM_RETRY_WINDOW_MS
} from '../config';
import { t } from '../i18n/i18n';
import { formatCountdown, formatDurationHoursMinutes, parseHHMMToSeconds } from '../lib/durations';
import { errorStatus } from '../lib/errors';
import { delay, millisecondsUntilNextSecond, waitForMinimumFeedback } from '../lib/timing';
import { reviewStore, focusStore, type FinishLabel } from '../session/ui-state';
import { setFloatingMessage } from '../shared/floating-message';
import { getCurrentScreenName, navigateTo } from '../shared/navigation';
import type { RoomSessionEnvelope, RoomSessionNotice, RoomSessionPayload, RoomSessionResult } from '../types/rooms';
import type { ScreenName } from '../types/screens';
import {
    fetchRoomSession,
    fetchRoomSummary,
    postFinishRoomSession,
    postRoomSessionEvent,
    postStartRoomSession
} from './api';
import { armCheckinSound, cancelCheckinSound, unlockCheckinAudio } from './checkin-sound';
import { loadRoom, openRoom, showUnavailableRoom, startRoomPolling } from './room';
import {
    createInitialRoomSessionState, patchRoomDisplay, roomSessionStore, type RoomSessionState
} from './room-session-state';
import { roomSnapshotCache, roomStore } from './state';

/** Fields that an outcome does not have. Declaring them as undefined lets the code test `outcome.stale` on any outcome. */
type Without<K extends string> = { [P in K]?: undefined };

/** How a queued room-session request ended. */
type QueuedOutcome =
    | ({ result: RoomSessionResult } & Without<'stale' | 'unauthorized' | 'failed'>)
    | ({ unauthorized: true } & Without<'result' | 'stale' | 'failed'>)
    | ({ failed: true } & Without<'result' | 'stale' | 'unauthorized'>)
    | ({ stale: true } & Without<'result' | 'unauthorized' | 'failed'>);

/** How a request run under the single in-flight lock ended. */
type LockedOutcome<R> =
    | ({ result: R } & Without<'skipped' | 'unauthorized' | 'failed'>)
    | ({ skipped: true } & Without<'result' | 'unauthorized' | 'failed'>)
    | ({ unauthorized: true } & Without<'result' | 'skipped' | 'failed'>)
    | ({ failed: true } & Without<'result' | 'skipped' | 'unauthorized'>);

/** The Finish label to bring back when the room session request ends. */
let restoreFinishLabel: FinishLabel | null = null;

/** Report whether a response is a room-session envelope. */
export function isRoomSessionEnvelope(result: RoomSessionResult | undefined): result is RoomSessionEnvelope {
    return result !== undefined && 'server_time' in result && typeof result.server_time === 'string';
}

/** Return the seconds worked so far, with decimals, counted on this device's clock. */
function computeRoomExactSeconds(nowMs: number): number {
    const state = roomSessionStore.get();
    const endMs = state.pausedAtMs ?? nowMs;
    return (endMs - state.startedAtMs) / 1000 - state.pausedSeconds;
}

/** Return the whole seconds worked so far, counted on this device's clock. */
function computeRoomActualSeconds(nowMs: number): number {
    return Math.max(0, Math.floor(computeRoomExactSeconds(nowMs)));
}

/** Refresh the display values and return the exact completion percentage. */
function refreshRoomDisplay(): number {
    const targetTimeSeconds = roomSessionStore.get().display.targetTimeSeconds;
    const actualTimeSeconds = computeRoomActualSeconds(Date.now());
    patchRoomDisplay({
        actualTimeSeconds,
        percentageCompleted: Math.floor(actualTimeSeconds / targetTimeSeconds * 100),
        completionStatus: actualTimeSeconds >= targetTimeSeconds ? 'completed' : 'partial'
    });
    return actualTimeSeconds / targetTimeSeconds * 100;
}

/** Return the floating message for a session that ended without the user. */
function getSessionEndMessage(notice: RoomSessionNotice): { text: string; error?: boolean } {
    const time = formatDurationHoursMinutes(notice.actual_time_seconds ?? 0);
    const messages: Partial<Record<string, { text: string; error?: boolean }>> = {
        'missed_checkin:true': { text: t('rooms.endMissedSaved', { time }) },
        'missed_checkin:false': { text: t('rooms.endMissedNotSaved'), error: true },
        'paused_timeout:true': { text: t('rooms.endPausedSaved', { time }) },
        'disconnected:true': { text: t('rooms.endDisconnectedSaved', { time }) },
        'disconnected:false': { text: t('rooms.endDisconnectedNotSaved'), error: true }
    };
    return messages[`${notice.reason}:${notice.saved}`]
        ?? { text: t('rooms.endGeneric'), error: !notice.saved };
}

/** Rebuild the timeline of a session this device does not know yet, for example after a reload, from the time the server counted. */
function adoptServerTimeline(session: RoomSessionPayload): void {
    const nowMs = Date.now();
    const isPaused = session.state === 'paused';
    roomSessionStore.update({
        isPaused,
        startedAtMs: nowMs - session.actual_time_seconds * 1000,
        pausedAtMs: isPaused ? nowMs : null,
        pausedSeconds: 0
    });
}

/** Return where the check-in stands. It is counted on the time worked: it is due when the next whole hour of work is reached. */
function computeCheckin(): RoomSessionState['checkin'] {
    const state = roomSessionStore.get();
    if (!state.active || state.isPaused) return { dueAtMs: null, deadlineAtMs: null, outstanding: false };
    const nowMs = Date.now();
    const untilDueMs = state.checkinMark * CHECKIN_INTERVAL_MS - computeRoomExactSeconds(nowMs) * 1000;
    return { dueAtMs: nowMs + untilDueMs, deadlineAtMs: nowMs + untilDueMs + CHECKIN_RESPONSE_MS, outstanding: untilDueMs <= 0 };
}

/**
 * Copy a room-session envelope into the client state. Return whether a session is active.
 * This device counts the time. The envelope only changes it when this device has no session yet,
 * and when the server says the session is paused or running and this device disagrees.
 */
export function applyRoomSessionEnvelope(envelope: RoomSessionEnvelope): boolean {
    if (envelope.notice) {
        const { text, error } = getSessionEndMessage(envelope.notice);
        setFloatingMessage(text, { error: Boolean(error) });
    }
    const session = envelope.session;
    if (!envelope.active || !session) return false;
    const isKnown = roomSessionStore.get().active;
    if (!isKnown) adoptServerTimeline(session);
    else if (session.state === 'paused' && !roomSessionStore.get().isPaused) applyLocalPause();
    else if (session.state === 'running' && roomSessionStore.get().isPaused) applyLocalResume();
    const state = roomSessionStore.get();
    roomSessionStore.update({
        active: true,
        submissionId: session.submission_id,
        roomId: session.room_id,
        roomName: session.room_name,
        checkinMark: session.checkin.mark,
        display: {
            ...state.display,
            currentMission: session.mission,
            targetTimeSeconds: session.target_time_seconds
        }
    });
    scheduleCheckin();
    return true;
}

/** Update the Focus screen from the room session state, and aim the next tick at the next second. */
function renderRoomFocus(): void {
    refreshRoomDisplay();
    focusStore.set({ pauseLabel: roomSessionStore.get().isPaused ? 'Resume' : 'Pause' });
    scheduleRoomTick();
}

/** Redraw Focus or Review after the server changed the session. Review then shows the time that the server will save. */
function refreshRoomSessionView(): void {
    const screen = getCurrentScreenName();
    if (screen === 'focus') renderRoomFocus();
    else if (screen === 'review') refreshRoomDisplay();
}

/** Show the time at this moment, and wait for the next second. */
function tickRoomSession(): void {
    if (!roomSessionStore.get().active) return;
    refreshRoomDisplay();
    scheduleRoomTick();
}

/** Wake up exactly when the shown second changes, so the number is never behind the clock. Nothing waits while the session is paused. */
function scheduleRoomTick(): void {
    const state = roomSessionStore.get();
    clearTimeout(state.tickTimer ?? undefined);
    if (!state.active || state.isPaused) {
        roomSessionStore.update({ tickTimer: null });
        return;
    }
    const waitMs = millisecondsUntilNextSecond(computeRoomExactSeconds(Date.now()));
    roomSessionStore.update({ tickTimer: setTimeout(tickRoomSession, waitMs) });
}

/** Start the display timer and the heartbeat. */
function startRoomSessionTimers(): void {
    stopRoomSessionTimers();
    scheduleRoomTick();
    roomSessionStore.update({ heartbeatTimer: setInterval(sendRoomHeartbeat, HEARTBEAT_INTERVAL_MS) });
}

/**
 * Bring the room timer up to date when the tab becomes visible again.
 * A hidden tab runs its timers late, so the number may be old and the check-in popup may be late.
 */
export function handleRoomTabVisible(): void {
    const state = roomSessionStore.get();
    if (!state.active) return;
    refreshRoomSessionView();
    if (!state.checkinOpen) scheduleCheckin();
}

/** Stop the display timer and the heartbeat. */
function stopRoomSessionTimers(): void {
    const state = roomSessionStore.get();
    clearTimeout(state.tickTimer ?? undefined);
    clearInterval(state.heartbeatTimer ?? undefined);
    roomSessionStore.update({ tickTimer: null, heartbeatTimer: null });
}

/** Tell the server the client is alive, ignoring answers that an event has overtaken. */
async function sendRoomHeartbeat(): Promise<void> {
    const state = roomSessionStore.get();
    if (!state.active || state.heartbeatInFlight || state.isBusy || state.pending > 0) return;
    roomSessionStore.update({ heartbeatInFlight: true });
    const eventCounter = state.eventCounter;
    try {
        const result = await postRoomSessionEvent('heartbeat', getCurrentScreenName());
        const current = roomSessionStore.get();
        if (!current.active || eventCounter !== current.eventCounter) return;
        if (!isRoomSessionEnvelope(result)) return;
        if (applyRoomSessionEnvelope(result)) reconcileRoomSessionScreen();
        else await endRoomSession();
    } catch (error) {
        if (errorStatus(error) !== 401) console.error('Heartbeat failed:', error);
    } finally {
        roomSessionStore.update({ heartbeatInFlight: false });
    }
}

/** Ask the server for the current room session, for example when a check-in expires. */
async function refreshRoomSession(): Promise<void> {
    try {
        const result = await fetchRoomSession(getCurrentScreenName());
        if (!isRoomSessionEnvelope(result)) return;
        if (applyRoomSessionEnvelope(result)) reconcileRoomSessionScreen();
        else await endRoomSession();
    } catch (error) {
        if (errorStatus(error) !== 401) console.error('Could not refresh the room session:', error);
    }
}

/** Show the screen the server's session state calls for, then redraw it. */
function reconcileRoomSessionScreen(): void {
    const screen = getCurrentScreenName();
    if (!roomSessionStore.get().isPaused && screen === 'review') {
        roomSessionStore.update({ finishFailed: false });
        enterRoomSessionFocus('review');
        return;
    }
    refreshRoomSessionView();
}

/** Open the check-in popup and start its countdown. */
function openCheckinModal(): void {
    const state = roomSessionStore.get();
    if (!state.active || state.checkinOpen) return;
    roomSessionStore.update({ countdownRefreshed: false, checkinOpen: true });
    void updateCheckinCountdown();
    roomSessionStore.update({ countdownTimer: setInterval(updateCheckinCountdown, 1000) });
}

/** Close the check-in popup and stop its countdown. */
function closeCheckinModal(): void {
    clearInterval(roomSessionStore.get().countdownTimer ?? undefined);
    roomSessionStore.update({ countdownTimer: null, checkinOpen: false });
}

/** Show the time left to respond. At zero, ask the server once what happened. */
async function updateCheckinCountdown(): Promise<void> {
    const state = roomSessionStore.get();
    const deadlineAtMs = state.checkin.deadlineAtMs ?? Date.now();
    const remainingSeconds = Math.ceil((deadlineAtMs - Date.now()) / 1000);
    roomSessionStore.update({ checkinCountdown: t('checkin.countdown', { time: formatCountdown(Math.max(0, remainingSeconds)) }) });
    if (remainingSeconds > 0 || state.countdownRefreshed) return;
    roomSessionStore.update({ countdownRefreshed: true });
    await refreshRoomSession();
}

/** Work out where the check-in stands, then open the popup at its due time, or close it when nothing is due. */
function scheduleCheckin(): void {
    clearTimeout(roomSessionStore.get().checkinTimer ?? undefined);
    cancelCheckinSound();
    roomSessionStore.update({ checkin: computeCheckin() });
    const { active, isPaused, checkin } = roomSessionStore.get();
    const { dueAtMs, outstanding } = checkin;
    if (!active || isPaused || dueAtMs === null) {
        closeCheckinModal();
        return;
    }
    const delayMs = dueAtMs - Date.now();
    if (outstanding || delayMs <= 0) {
        openCheckinModal();
        return;
    }
    closeCheckinModal();
    roomSessionStore.update({ checkinTimer: setTimeout(openCheckinModal, delayMs) });
    armCheckinSound();
}

/** Lock or unlock the room session controls while a server-confirmed request (Finish) is in flight. */
function setRoomSessionBusy(isBusy: boolean, busyLabel: FinishLabel | null = null): void {
    roomSessionStore.update({ isBusy });
    if (isBusy && busyLabel !== null) {
        restoreFinishLabel = reviewStore.get().finishLabel;
        reviewStore.update({ finishLabel: busyLabel });
    } else if (!isBusy && restoreFinishLabel !== null) {
        reviewStore.update({ finishLabel: restoreFinishLabel });
        restoreFinishLabel = null;
    }
}

/** Send one server-confirmed room session request under the single in-flight lock. */
async function performRoomSessionRequest<R>(
    busyLabel: FinishLabel,
    request: () => Promise<R>,
    minimumFeedbackStartedAt: number | null = null
): Promise<LockedOutcome<R>> {
    if (roomSessionStore.get().isBusy) return { skipped: true };
    roomSessionStore.update({ eventCounter: roomSessionStore.get().eventCounter + 1 });
    setRoomSessionBusy(true, busyLabel);
    try {
        const result = await request();
        if (minimumFeedbackStartedAt !== null) await waitForMinimumFeedback(minimumFeedbackStartedAt);
        return { result };
    } catch (error) {
        if (errorStatus(error) === 401) return { unauthorized: true };
        console.error('Room session request failed:', error);
        return { failed: true };
    } finally {
        setRoomSessionBusy(false);
    }
}

/** Send a request, retrying network and server failures until the retry window closes. */
async function sendRoomSessionWithRetry(request: () => Promise<RoomSessionResult>, generation: number): Promise<QueuedOutcome> {
    const startedAt = performance.now();
    for (;;) {
        try {
            const result = await request();
            if (isRoomSessionEnvelope(result) || result.status < 500) return { result };
        } catch (error) {
            if (errorStatus(error) === 401) return { unauthorized: true };
            console.error('Room session request failed:', error);
        }
        if (performance.now() - startedAt + ROOM_RETRY_DELAY_MS > ROOM_RETRY_WINDOW_MS) return { failed: true };
        await delay(ROOM_RETRY_DELAY_MS);
        if (generation !== roomSessionStore.get().generation) return { stale: true };
    }
}

/** Queue a request behind the earlier ones, so the server sees events in the order the user made them. */
function enqueueRoomSessionRequest(request: () => Promise<RoomSessionResult>): Promise<QueuedOutcome> {
    const state = roomSessionStore.get();
    const generation = state.generation;
    roomSessionStore.update({ pending: state.pending + 1, eventCounter: state.eventCounter + 1 });
    const job = roomSessionStore.get().queueTail.then(/** Send this request unless the session was reset first. */ async (): Promise<QueuedOutcome> => {
        const outcome: QueuedOutcome = generation === roomSessionStore.get().generation
            ? await sendRoomSessionWithRetry(request, generation)
            : { stale: true };
        if (generation === roomSessionStore.get().generation) {
            roomSessionStore.update({ pending: roomSessionStore.get().pending - 1 });
        }
        return outcome;
    });
    roomSessionStore.update({ queueTail: job });
    return job;
}

/** Show a room session error as a floating message. */
function showRoomSessionError(message: string): void {
    setFloatingMessage(message, { error: true });
}

/** Show an error on the Review screen. */
function showReviewRoomError(message: string): void {
    reviewStore.update({ saveMessage: message });
}

/**
 * Apply the outcome of a queued request. Only the last request in the queue applies the server's
 * state, and a failed one asks the server what is true. Return whether the server accepted it.
 */
async function settleRoomSessionOutcome(outcome: QueuedOutcome, errorMessage: string): Promise<boolean> {
    if (outcome.stale || outcome.unauthorized) return false;
    const envelope = outcome.result;
    if (outcome.failed || !isRoomSessionEnvelope(envelope)) {
        showRoomSessionError(errorMessage);
        if (roomSessionStore.get().pending === 0) await refreshRoomSession();
        return false;
    }
    if (roomSessionStore.get().pending > 0) {
        if (envelope.session) roomSessionStore.update({ submissionId: envelope.session.submission_id });
        return envelope.success;
    }
    if (applyRoomSessionEnvelope(envelope)) reconcileRoomSessionScreen();
    else await endRoomSession();
    return envelope.success;
}

/** Show the Focus screen for the running room session and start its timers. */
export function enterRoomSessionFocus(currentScreen: ScreenName): void {
    navigateTo('focus', currentScreen);
    renderRoomFocus();
    startRoomSessionTimers();
    scheduleCheckin();
}

/** Clear everything the client holds about a room session. */
export function resetRoomSessionClient(): void {
    const generation = roomSessionStore.get().generation + 1;
    stopRoomSessionTimers();
    clearTimeout(roomSessionStore.get().checkinTimer ?? undefined);
    closeCheckinModal();
    cancelCheckinSound();
    if (roomSessionStore.get().isBusy) setRoomSessionBusy(false);
    roomSessionStore.set({ ...createInitialRoomSessionState(), generation });
}

/** Add a just-saved session to the cached room summary, so the room looks right before it reloads. */
function addSavedSessionToCachedSummary(roomId: number, seconds: number): void {
    const cached = roomSnapshotCache.get(roomId);
    if (!cached) return;
    const summary = cached.summary;
    const totalSessions = summary.total_sessions + 1;
    const totalTime = summary.total_time_seconds + seconds;
    roomSnapshotCache.set(roomId, {
        ...cached,
        summary: {
            ...summary,
            total_sessions: totalSessions,
            total_time_seconds: totalTime,
            average_session_time_seconds: Math.round(totalTime / totalSessions)
        }
    });
}

/** Leave Focus or Review after the session ended, and return to its room. */
async function endRoomSession({ saved = false }: { saved?: boolean } = {}): Promise<void> {
    const roomId = roomSessionStore.get().roomId;
    const savedSeconds = roomSessionStore.get().display.actualTimeSeconds;
    const screen = getCurrentScreenName();
    resetRoomSessionClient();
    reviewStore.update({ finishLabel: 'Finish', saveMessage: '' });
    if (saved) {
        setFloatingMessage(t('session.saved'), { saved: true });
        if (roomId !== null) addSavedSessionToCachedSummary(roomId, savedSeconds);
    }
    if (roomId !== null && (screen === 'focus' || screen === 'review')) await openRoom(roomId, screen);
}

/** Show Focus for a session the server has not confirmed yet. The time is counted from this moment, on this device. */
function beginLocalRoomSession(roomId: number, mission: string, targetTimeSeconds: number): void {
    const state = roomSessionStore.get();
    roomSessionStore.update({
        active: true,
        submissionId: '',
        roomId,
        roomName: roomStore.get().snapshot?.room.name ?? '',
        isPaused: false,
        startedAtMs: Date.now(),
        pausedAtMs: null,
        pausedSeconds: 0,
        checkinMark: 1,
        display: { ...state.display, currentMission: mission, targetTimeSeconds }
    });
    enterRoomSessionFocus('room');
}

/** Pause the session on this screen right away. */
function applyLocalPause(): void {
    roomSessionStore.update({ isPaused: true, pausedAtMs: Date.now() });
    scheduleCheckin();
}

/** Resume the session on this screen right away. The check-in is counted on the time worked, so it moves later by itself. */
function applyLocalResume(): void {
    const state = roomSessionStore.get();
    if (state.pausedAtMs === null) return;
    roomSessionStore.update({
        pausedSeconds: state.pausedSeconds + (Date.now() - state.pausedAtMs) / 1000,
        pausedAtMs: null,
        isPaused: false
    });
    scheduleCheckin();
}

/** Undo the Start screen after the server could not start the session, keeping the form. */
function rollbackRoomStart(errorMessage: string): void {
    resetRoomSessionClient();
    navigateTo('room', 'focus');
    startRoomPolling();
    void loadRoom({ silent: true });
    showRoomSessionError(errorMessage);
}

/** Apply the server's answer to Start: keep the session, or return to the Room screen. */
async function settleRoomStart(outcome: QueuedOutcome): Promise<void> {
    if (outcome.stale || outcome.unauthorized) return;
    if (outcome.result?.status === 404) {
        resetRoomSessionClient();
        showUnavailableRoom('focus');
        return;
    }
    if (outcome.failed || !isRoomSessionEnvelope(outcome.result)) {
        rollbackRoomStart(t('rooms.errorStart'));
        return;
    }
    await settleRoomSessionOutcome(outcome, t('rooms.errorStart'));
}

/** Show Focus at once and start the room session on the server. The mission card is already valid. */
export async function startRoomWork(mission: string, targetTime: string): Promise<void> {
    if (roomSessionStore.get().active) return;
    void unlockCheckinAudio();
    const roomId = roomStore.get().roomId;
    if (roomId === null) return;
    const targetTimeSeconds = parseHHMMToSeconds(targetTime);
    beginLocalRoomSession(roomId, mission, targetTimeSeconds);
    const outcome = await enqueueRoomSessionRequest(
        /** Send the Start request for the room's mission card. */
        () => postStartRoomSession(roomId, mission, targetTimeSeconds)
    );
    await settleRoomStart(outcome);
}

/** Pause or resume the room session from Focus. */
export async function handleRoomPauseResume(): Promise<void> {
    if (!roomSessionStore.get().active) return;
    const pausing = !roomSessionStore.get().isPaused;
    if (pausing) applyLocalPause();
    else applyLocalResume();
    renderRoomFocus();
    const workedSeconds = roomSessionStore.get().display.actualTimeSeconds;
    const outcome = await enqueueRoomSessionRequest(
        /** Send the pause event with the seconds counted at the click, or the resume event. */
        () => postRoomSessionEvent(pausing ? 'pause' : 'resume', getCurrentScreenName(), pausing ? workedSeconds : undefined)
    );
    await settleRoomSessionOutcome(outcome, pausing ? t('rooms.errorPause') : t('rooms.errorResume'));
}

/** Fill the Review summary cards at once from the last known room summary plus this session. Return whether it could. */
function renderReviewRoomSummaryFromCache(): boolean {
    const roomId = roomSessionStore.get().roomId;
    const cached = roomId === null ? undefined : roomSnapshotCache.get(roomId);
    if (!cached) return false;
    const totalSessions = cached.summary.total_sessions + 1;
    const totalTime = cached.summary.total_time_seconds + roomSessionStore.get().display.actualTimeSeconds;
    reviewStore.update({
        roomSummary: {
            ...cached.summary,
            total_sessions: totalSessions,
            total_time_seconds: totalTime,
            average_session_time_seconds: Math.round(totalTime / totalSessions)
        }
    });
    return true;
}

/** Load the room's summary once, counting the paused session, to correct the Review cards. */
async function loadReviewRoomSummary(): Promise<void> {
    const roomId = roomSessionStore.get().roomId;
    if (roomId === null) return;
    try {
        const result = await fetchRoomSummary(roomId, true);
        const state = roomSessionStore.get();
        if (!state.active || state.roomId !== roomId) return;
        if (!result.success) throw new Error(result.error);
        reviewStore.update({ roomSummary: result.summary });
    } catch (error) {
        if (errorStatus(error) !== 401) console.error('Could not load the room summary:', error);
    }
}

/** Stop the room session: open Review at once and pause it on the server. */
export async function handleRoomStop(): Promise<void> {
    if (!roomSessionStore.get().active) return;
    const needsPause = !roomSessionStore.get().isPaused;
    if (needsPause) applyLocalPause();
    refreshRoomDisplay();
    navigateTo('review', 'focus');
    if (!renderReviewRoomSummaryFromCache()) reviewStore.update({ roomSummary: null });
    void loadReviewRoomSummary();
    if (!needsPause) return;
    const workedSeconds = roomSessionStore.get().display.actualTimeSeconds;
    const outcome = await enqueueRoomSessionRequest(
        /** Send the pause event that Stop uses, with the seconds counted at the click. */
        () => postRoomSessionEvent('pause', getCurrentScreenName(), workedSeconds)
    );
    await settleRoomSessionOutcome(outcome, t('rooms.errorStop'));
}

/** Resume reviewed work: return to Focus at once and resume on the server. */
export async function handleRoomContinue(): Promise<void> {
    if (!roomSessionStore.get().active) return;
    reviewStore.update({ saveMessage: '' });
    roomSessionStore.update({ finishFailed: false });
    if (roomSessionStore.get().isPaused) applyLocalResume();
    navigateTo('focus', 'review');
    renderRoomFocus();
    const outcome = await enqueueRoomSessionRequest(
        /** Send the resume event that Continue uses. */
        () => postRoomSessionEvent('resume', getCurrentScreenName())
    );
    await settleRoomSessionOutcome(outcome, t('rooms.errorContinue'));
}

/** Save the room session on the server. A failed Finish retries with the same submission ID. */
export async function handleRoomFinish(): Promise<void> {
    const feedbackStartedAt = performance.now();
    reviewStore.update({ saveMessage: '' });
    const outcome = await performRoomSessionRequest(
        roomSessionStore.get().finishFailed ? 'Retrying…' : 'Saving…',
        /** Wait for earlier events, then send the Finish request for this session. */
        async () => {
            await roomSessionStore.get().queueTail;
            const current = roomSessionStore.get();
            if (!current.active || !current.submissionId) throw new Error('The session ended before it could be saved');
            return postFinishRoomSession(current.submissionId, current.display.actualTimeSeconds);
        },
        feedbackStartedAt
    );
    if (outcome.skipped || outcome.unauthorized || !roomSessionStore.get().active) return;
    const result = outcome.result;
    if (outcome.failed || !isRoomSessionEnvelope(result)) {
        roomSessionStore.update({ finishFailed: true });
        reviewStore.update({ finishLabel: 'Try again' });
        showReviewRoomError(t('session.finishFailed'));
        return;
    }
    if (applyRoomSessionEnvelope(result)) {
        roomSessionStore.update({ finishFailed: false });
        if (!roomSessionStore.get().isPaused) {
            navigateTo('focus', 'review');
            renderRoomFocus();
        }
        return;
    }
    await endRoomSession({ saved: result.saved === true });
}

/** Confirm presence: close the popup at once and send the check-in. */
export async function handleCheckinConfirm(): Promise<void> {
    const state = roomSessionStore.get();
    if (!state.active) return;
    refreshRoomDisplay();
    const workedSeconds = roomSessionStore.get().display.actualTimeSeconds;
    roomSessionStore.update({ checkinMark: state.checkinMark + 1 });
    scheduleCheckin();
    const outcome = await enqueueRoomSessionRequest(
        /** Send the check-in event, with the seconds counted at the click. */
        () => postRoomSessionEvent('checkin', getCurrentScreenName(), workedSeconds)
    );
    await settleRoomSessionOutcome(outcome, t('rooms.errorCheckin'));
}

/** Set the Finish label for the room version of the Review screen. */
export function setReviewRoomMode(enabled: boolean): void {
    if (!enabled) return;
    reviewStore.update({ finishLabel: roomSessionStore.get().finishFailed ? 'Try again' : 'Finish' });
}
