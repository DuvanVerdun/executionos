// The room session on the client: timers, check-ins, and Focus and Review in a room.

import {
    CHECKIN_INTERVAL_MS,
    CHECKIN_RESPONSE_MS,
    HEARTBEAT_INTERVAL_MS,
    ROOM_RETRY_DELAY_MS,
    ROOM_RETRY_WINDOW_MS
} from '../config.js';
import { parseServerTime } from '../lib/dates.js';
import {
    formatAverageSessionTime,
    formatCountdown,
    formatDurationHoursMinutes,
    parseHHMMToSeconds
} from '../lib/durations.js';
import { delay, waitForMinimumFeedback } from '../lib/timing.js';
import { focusDom, reviewDom } from '../session/dom.js';
import { validateMissionFields } from '../session/plan.js';
import { renderFocusSession, renderFocusTimer } from '../session/views.js';
import { setFloatingMessage } from '../shared/floating-message.js';
import { navigateTo } from '../shared/navigation.js';
import { getCurrentScreenName } from '../shared/screens.js';
import {
    fetchRoomSession,
    fetchRoomSummary,
    postFinishRoomSession,
    postRoomSessionEvent,
    postStartRoomSession
} from './api.js';
import {
    armCheckinSound,
    cancelCheckinSound,
    handleRoomSessionGesture,
    unlockCheckinAudio
} from './checkin-sound.js';
import { getServerNowMs, updateClockOffset } from './clock.js';
import { ROOM_COPY } from './copy.js';
import { modalsDom, roomDom } from './dom.js';
import { loadRoom, openRoom, showUnavailableRoom, startRoomPolling } from './room-screen.js';
import { createInitialRoomSessionState, roomSessionState, roomSnapshotCache, roomState } from './state.js';

/** Report whether a response is a room-session envelope. */
export function isRoomSessionEnvelope(result) {
    return typeof result?.server_time === 'string';
}

/** Return the seconds worked so far, from the server's timestamps. */
function computeRoomActualSeconds(nowMs) {
    const endMs = roomSessionState.pausedAtMs ?? nowMs;
    const elapsedSeconds = (endMs - roomSessionState.startedAtMs) / 1000 - roomSessionState.pausedSeconds;
    return Math.max(0, Math.floor(elapsedSeconds));
}

/** Refresh the display values and return the exact completion percentage. */
function updateRoomDisplay() {
    const display = roomSessionState.display;
    display.actualTimeSeconds = computeRoomActualSeconds(getServerNowMs());
    display.percentageCompleted = Math.floor(display.actualTimeSeconds / display.targetTimeSeconds * 100);
    display.completionStatus = display.actualTimeSeconds >= display.targetTimeSeconds ? 'completed' : 'partial';
    return display.actualTimeSeconds / display.targetTimeSeconds * 100;
}

/** Return the floating message for a session that ended without the user. */
function getSessionEndMessage(notice) {
    const time = formatDurationHoursMinutes(notice.actual_time_seconds ?? 0);
    const messages = {
        'missed_checkin:true': { text: `You didn't check in. Session saved up to ${time}.` },
        'missed_checkin:false': { text: "You didn't check in and there was no activity. Session not saved.", error: true },
        'paused_timeout:true': { text: `You left your session paused. Saved at ${time}.` },
        'disconnected:true': { text: `Your session ended when the app closed. Saved up to ${time}.` },
        'disconnected:false': { text: 'Your session ended when the app closed, with no activity. Not saved.', error: true }
    };
    return messages[`${notice.reason}:${notice.saved}`]
        ?? { text: ROOM_COPY.sessionEndedGeneric, error: !notice.saved };
}

/** Copy a room-session envelope into the client state. Return whether a session is active. */
export function applyRoomSessionEnvelope(envelope, sentAtMs, receivedAtMs) {
    updateClockOffset(envelope, sentAtMs, receivedAtMs);
    if (envelope.notice) {
        const { text, error } = getSessionEndMessage(envelope.notice);
        setFloatingMessage(text, { error: Boolean(error) });
    }
    if (!envelope.active) return false;

    const session = envelope.session;
    const checkin = session.checkin;
    Object.assign(roomSessionState, {
        active: true,
        submissionId: session.submission_id,
        roomId: session.room_id,
        roomName: session.room_name ?? '',
        isPaused: session.state === 'paused',
        startedAtMs: parseServerTime(session.started_at),
        pausedAtMs: session.paused_at === null ? null : parseServerTime(session.paused_at),
        pausedSeconds: session.paused_seconds,
        checkin: {
            dueAtMs: checkin.due_at === null ? null : parseServerTime(checkin.due_at),
            deadlineAtMs: checkin.deadline_at === null ? null : parseServerTime(checkin.deadline_at),
            outstanding: checkin.outstanding
        }
    });
    roomSessionState.display.currentMission = session.mission;
    roomSessionState.display.targetTimeSeconds = session.target_time_seconds;
    scheduleCheckin();
    return true;
}

/** Render the Focus screen from the room session state. */
function renderRoomFocus() {
    const exactPercentage = updateRoomDisplay();
    focusDom.roomName.textContent = roomSessionState.roomName;
    renderFocusSession(roomSessionState.display);
    renderFocusTimer(roomSessionState.display, exactPercentage);
    focusDom.pauseButton.textContent = roomSessionState.isPaused ? 'Resume' : 'Pause';
}

/** Redraw Focus after the server changed the session, when Focus is showing. */
function refreshRoomSessionView() {
    if (getCurrentScreenName() === 'focus') renderRoomFocus();
}

/** Update the running timer display once per second. */
function tickRoomSession() {
    if (!roomSessionState.active || roomSessionState.isPaused) return;
    const exactPercentage = updateRoomDisplay();
    renderFocusTimer(roomSessionState.display, exactPercentage);
}

/** Start the display timer and the heartbeat. */
function startRoomSessionTimers() {
    stopRoomSessionTimers();
    roomSessionState.tickTimer = setInterval(tickRoomSession, 1000);
    roomSessionState.heartbeatTimer = setInterval(sendRoomHeartbeat, HEARTBEAT_INTERVAL_MS);
}

/** Stop the display timer and the heartbeat. */
function stopRoomSessionTimers() {
    clearInterval(roomSessionState.tickTimer);
    clearInterval(roomSessionState.heartbeatTimer);
    roomSessionState.tickTimer = null;
    roomSessionState.heartbeatTimer = null;
}

/** Tell the server the client is alive, ignoring answers that an event has overtaken. */
async function sendRoomHeartbeat() {
    const state = roomSessionState;
    if (!state.active || state.heartbeatInFlight || state.isBusy || state.pending > 0) return;
    state.heartbeatInFlight = true;
    const eventCounter = state.eventCounter;
    try {
        const { result, sentAtMs, receivedAtMs } = await timeRoomRequest(() => postRoomSessionEvent('heartbeat'));
        if (!state.active || eventCounter !== state.eventCounter) return;
        if (!isRoomSessionEnvelope(result)) return;
        if (applyRoomSessionEnvelope(result, sentAtMs, receivedAtMs)) reconcileRoomSessionScreen();
        else await endRoomSession();
    } catch (error) {
        if (error.status !== 401) console.error('Heartbeat failed:', error);
    } finally {
        roomSessionState.heartbeatInFlight = false;
    }
}

/** Ask the server for the current room session, for example when a check-in expires. */
async function refreshRoomSession() {
    try {
        const { result, sentAtMs, receivedAtMs } = await timeRoomRequest(() => fetchRoomSession());
        if (!isRoomSessionEnvelope(result)) return;
        if (applyRoomSessionEnvelope(result, sentAtMs, receivedAtMs)) reconcileRoomSessionScreen();
        else await endRoomSession();
    } catch (error) {
        if (error.status !== 401) console.error('Could not refresh the room session:', error);
    }
}

/** Run a request and return its result with the times it was sent and answered. */
export async function timeRoomRequest(request) {
    const sentAtMs = Date.now();
    const result = await request();
    return { result, sentAtMs, receivedAtMs: Date.now() };
}

/** Show the screen the server's session state calls for, then redraw it. */
function reconcileRoomSessionScreen() {
    const screen = getCurrentScreenName();
    if (!roomSessionState.isPaused && screen === 'review') {
        roomSessionState.finishFailed = false;
        enterRoomSessionFocus('review');
        return;
    }
    refreshRoomSessionView();
}

/** Open the check-in popup and start its countdown. */
function openCheckinModal() {
    const modal = modalsDom.checkin;
    if (!roomSessionState.active || !modal.overlay.hidden) return;
    roomSessionState.countdownRefreshed = false;
    modal.error.textContent = '';
    modal.overlay.hidden = false;
    modal.confirmButton.focus();
    void updateCheckinCountdown();
    roomSessionState.countdownTimer = setInterval(updateCheckinCountdown, 1000);
}

/** Close the check-in popup and stop its countdown. */
function closeCheckinModal() {
    clearInterval(roomSessionState.countdownTimer);
    roomSessionState.countdownTimer = null;
    modalsDom.checkin.overlay.hidden = true;
}

/** Show the time left to respond. At zero, ask the server once what happened. */
async function updateCheckinCountdown() {
    const deadlineAtMs = roomSessionState.checkin.deadlineAtMs ?? getServerNowMs();
    const remainingSeconds = Math.ceil((deadlineAtMs - getServerNowMs()) / 1000);
    modalsDom.checkin.countdown.textContent = `${formatCountdown(Math.max(0, remainingSeconds))} left to respond`;
    if (remainingSeconds > 0 || roomSessionState.countdownRefreshed) return;
    roomSessionState.countdownRefreshed = true;
    await refreshRoomSession();
}

/** Open the check-in popup at its due time, or close it when nothing is due. */
function scheduleCheckin() {
    clearTimeout(roomSessionState.checkinTimer);
    cancelCheckinSound();
    const { dueAtMs, outstanding } = roomSessionState.checkin;
    if (!roomSessionState.active || roomSessionState.isPaused || dueAtMs === null) {
        closeCheckinModal();
        return;
    }
    const delayMs = dueAtMs - getServerNowMs();
    if (outstanding || delayMs <= 0) {
        openCheckinModal();
        return;
    }
    closeCheckinModal();
    roomSessionState.checkinTimer = setTimeout(openCheckinModal, delayMs);
    armCheckinSound();
}

/** Lock or unlock the room session controls while a server-confirmed request (Finish) is in flight. */
function setRoomSessionBusy(isBusy, button = null, busyLabel = '') {
    const controls = [
        focusDom.pauseButton, focusDom.stopButton, reviewDom.continueButton,
        reviewDom.finishButton, modalsDom.checkin.confirmButton, roomDom.startButton
    ];
    roomSessionState.isBusy = isBusy;
    controls.forEach(/** Set the disabled state of a room session control. */ (control) => {
        control.disabled = isBusy;
    });
    if (isBusy && button) {
        roomSessionState.busyButton = button;
        roomSessionState.restoreLabel = button.textContent;
        button.textContent = busyLabel;
    } else if (!isBusy && roomSessionState.busyButton) {
        roomSessionState.busyButton.textContent = roomSessionState.restoreLabel;
        roomSessionState.busyButton = null;
    }
}

/** Send one server-confirmed room session request under the single in-flight lock. */
async function performRoomSessionRequest(button, busyLabel, request, minimumFeedbackStartedAt = null) {
    if (roomSessionState.isBusy) return { skipped: true };
    roomSessionState.eventCounter += 1;
    setRoomSessionBusy(true, button, busyLabel);
    try {
        const result = await request();
        if (minimumFeedbackStartedAt !== null) await waitForMinimumFeedback(minimumFeedbackStartedAt);
        return { result };
    } catch (error) {
        if (error.status === 401) return { unauthorized: true };
        console.error('Room session request failed:', error);
        return { failed: true };
    } finally {
        setRoomSessionBusy(false);
    }
}

/** Send a request, retrying network and server failures until the retry window closes. */
async function sendRoomSessionWithRetry(request, generation) {
    const startedAt = performance.now();
    for (;;) {
        try {
            const timed = await timeRoomRequest(request);
            if (isRoomSessionEnvelope(timed.result) || timed.result.status < 500) return timed;
        } catch (error) {
            if (error.status === 401) return { unauthorized: true };
            console.error('Room session request failed:', error);
        }
        if (performance.now() - startedAt + ROOM_RETRY_DELAY_MS > ROOM_RETRY_WINDOW_MS) return { failed: true };
        await delay(ROOM_RETRY_DELAY_MS);
        if (generation !== roomSessionState.generation) return { stale: true };
    }
}

/** Queue a request behind the earlier ones, so the server sees events in the order the user made them. */
function enqueueRoomSessionRequest(request) {
    const state = roomSessionState;
    const generation = state.generation;
    state.pending += 1;
    state.eventCounter += 1;
    const job = state.queueTail.then(/** Send this request unless the session was reset first. */ async () => {
        const outcome = generation === state.generation
            ? await sendRoomSessionWithRetry(request, generation)
            : { stale: true };
        if (generation === state.generation) state.pending -= 1;
        return outcome;
    });
    state.queueTail = job;
    return job;
}

/** Show a room session error as a floating message. */
function showRoomSessionError(message) {
    setFloatingMessage(message, { error: true });
}

/** Show an error on the Review screen. */
function showReviewRoomError(message) {
    reviewDom.saveMessage.textContent = message;
}

/**
 * Apply the outcome of a queued request. Only the last request in the queue applies the server's
 * state, and a failed one asks the server what is true. Return whether the server accepted it.
 */
async function settleRoomSessionOutcome(outcome, errorMessage) {
    const state = roomSessionState;
    if (outcome.stale || outcome.unauthorized) return false;
    const envelope = outcome.result;
    if (outcome.failed || !isRoomSessionEnvelope(envelope)) {
        showRoomSessionError(errorMessage);
        if (state.pending === 0) await refreshRoomSession();
        return false;
    }
    if (state.pending > 0) {
        updateClockOffset(envelope, outcome.sentAtMs, outcome.receivedAtMs);
        if (envelope.session) state.submissionId = envelope.session.submission_id;
        return envelope.success === true;
    }
    if (applyRoomSessionEnvelope(envelope, outcome.sentAtMs, outcome.receivedAtMs)) reconcileRoomSessionScreen();
    else await endRoomSession();
    return envelope.success === true;
}

/** Show the Focus screen for the running room session and start its timers. */
export function enterRoomSessionFocus(currentScreen) {
    navigateTo('focus', currentScreen);
    renderRoomFocus();
    startRoomSessionTimers();
    scheduleCheckin();
}

/** Clear everything the client holds about a room session, keeping the clock offset. */
export function resetRoomSessionClient() {
    const generation = roomSessionState.generation + 1;
    const clockOffsetMs = roomSessionState.clockOffsetMs;
    stopRoomSessionTimers();
    clearTimeout(roomSessionState.checkinTimer);
    closeCheckinModal();
    cancelCheckinSound();
    if (roomSessionState.isBusy) setRoomSessionBusy(false);
    Object.assign(roomSessionState, createInitialRoomSessionState(), { generation, clockOffsetMs });
}

/** Add a just-saved session to the cached room summary, so the room looks right before it reloads. */
function addSavedSessionToCachedSummary(roomId, seconds) {
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
async function endRoomSession({ saved = false } = {}) {
    const roomId = roomSessionState.roomId;
    const savedSeconds = roomSessionState.display.actualTimeSeconds;
    const screen = getCurrentScreenName();
    resetRoomSessionClient();
    reviewDom.continueButton.classList.replace('normal-button', 'cta-button');
    reviewDom.finishButton.textContent = 'Finish';
    reviewDom.saveMessage.textContent = '';
    if (saved) {
        setFloatingMessage(ROOM_COPY.sessionSaved, { saved: true });
        addSavedSessionToCachedSummary(roomId, savedSeconds);
    }
    if (roomId !== null && (screen === 'focus' || screen === 'review')) await openRoom(roomId, screen);
}

/** Show Focus for a session the server has not confirmed yet. */
function beginLocalRoomSession(roomId, mission, targetTimeSeconds) {
    const startedAtMs = Math.round(getServerNowMs());
    Object.assign(roomSessionState, {
        active: true,
        submissionId: '',
        roomId,
        roomName: roomState.snapshot?.room.name ?? '',
        isPaused: false,
        startedAtMs,
        pausedAtMs: null,
        pausedSeconds: 0,
        checkin: {
            dueAtMs: startedAtMs + CHECKIN_INTERVAL_MS,
            deadlineAtMs: startedAtMs + CHECKIN_INTERVAL_MS + CHECKIN_RESPONSE_MS,
            outstanding: false
        }
    });
    roomSessionState.display.currentMission = mission;
    roomSessionState.display.targetTimeSeconds = targetTimeSeconds;
    enterRoomSessionFocus('room');
}

/** Pause the session on this screen right away. */
function applyLocalPause() {
    roomSessionState.isPaused = true;
    roomSessionState.pausedAtMs = getServerNowMs();
    scheduleCheckin();
}

/** Resume the session on this screen right away. The check-in moves later by the time paused. */
function applyLocalResume() {
    const state = roomSessionState;
    const pausedForMs = getServerNowMs() - state.pausedAtMs;
    state.pausedSeconds += pausedForMs / 1000;
    state.pausedAtMs = null;
    state.isPaused = false;
    if (state.checkin.dueAtMs !== null) {
        state.checkin.dueAtMs += pausedForMs;
        state.checkin.deadlineAtMs += pausedForMs;
    }
    scheduleCheckin();
}

/** Undo the Start screen after the server could not start the session, keeping the form. */
function rollbackRoomStart(errorMessage) {
    resetRoomSessionClient();
    navigateTo('room', 'focus');
    startRoomPolling();
    void loadRoom({ silent: true });
    showRoomSessionError(errorMessage);
}

/** Apply the server's answer to Start: keep the session, or return to the Room screen. */
async function settleRoomStart(outcome) {
    if (outcome.stale || outcome.unauthorized) return;
    if (outcome.result?.status === 404) {
        resetRoomSessionClient();
        showUnavailableRoom('focus');
        return;
    }
    if (outcome.failed || !isRoomSessionEnvelope(outcome.result)) {
        rollbackRoomStart(ROOM_COPY.sessionErrors.start);
        return;
    }
    await settleRoomSessionOutcome(outcome, ROOM_COPY.sessionErrors.start);
}

/** Validate the mission card, show Focus at once, and start the room session on the server. */
async function handleRoomStartWork() {
    roomDom.startError.textContent = '';
    if (roomSessionState.active || !validateMissionFields(roomDom)) return;
    void unlockCheckinAudio();
    const roomId = roomState.roomId;
    const mission = roomDom.mission.value;
    const targetTimeSeconds = parseHHMMToSeconds(roomDom.targetTime.value);
    beginLocalRoomSession(roomId, mission, targetTimeSeconds);
    const outcome = await enqueueRoomSessionRequest(
        /** Send the Start request for the room's mission card. */
        () => postStartRoomSession(roomId, mission, targetTimeSeconds)
    );
    await settleRoomStart(outcome);
}

/** Pause or resume the room session from Focus. */
export async function handleRoomPauseResume() {
    if (!roomSessionState.active) return;
    const pausing = !roomSessionState.isPaused;
    if (pausing) applyLocalPause();
    else applyLocalResume();
    renderRoomFocus();
    const outcome = await enqueueRoomSessionRequest(
        /** Send the pause or resume event. */
        () => postRoomSessionEvent(pausing ? 'pause' : 'resume')
    );
    await settleRoomSessionOutcome(outcome, pausing ? ROOM_COPY.sessionErrors.pause : ROOM_COPY.sessionErrors.resume);
}

/** Stop the room session: open Review at once and pause it on the server. */
export async function handleRoomStop() {
    if (!roomSessionState.active) return;
    const needsPause = !roomSessionState.isPaused;
    if (needsPause) applyLocalPause();
    updateRoomDisplay();
    navigateTo('review', 'focus');
    if (!renderReviewRoomSummaryFromCache()) renderReviewRoomSummary(null);
    void loadReviewRoomSummary();
    if (!needsPause) return;
    const outcome = await enqueueRoomSessionRequest(
        /** Send the pause event that Stop uses. */
        () => postRoomSessionEvent('pause')
    );
    await settleRoomSessionOutcome(outcome, ROOM_COPY.sessionErrors.stop);
}

/** Resume reviewed work: return to Focus at once and resume on the server. */
export async function handleRoomContinue() {
    if (!roomSessionState.active) return;
    reviewDom.saveMessage.textContent = '';
    roomSessionState.finishFailed = false;
    if (roomSessionState.isPaused) applyLocalResume();
    navigateTo('focus', 'review');
    renderRoomFocus();
    const outcome = await enqueueRoomSessionRequest(
        /** Send the resume event that Continue uses. */
        () => postRoomSessionEvent('resume')
    );
    await settleRoomSessionOutcome(outcome, ROOM_COPY.sessionErrors.continue);
}

/** Save the room session on the server. A failed Finish retries with the same submission ID. */
export async function handleRoomFinish() {
    const state = roomSessionState;
    const feedbackStartedAt = performance.now();
    reviewDom.saveMessage.textContent = '';
    const outcome = await performRoomSessionRequest(
        reviewDom.finishButton, state.finishFailed ? 'Retrying…' : 'Saving…',
        /** Wait for earlier events, then send the Finish request for this session. */
        async () => {
            await state.queueTail;
            if (!state.active || !state.submissionId) throw new Error('The session ended before it could be saved');
            return postFinishRoomSession(state.submissionId);
        },
        feedbackStartedAt
    );
    if (outcome.skipped || outcome.unauthorized || !state.active) return;
    const result = outcome.result;
    if (outcome.failed || !isRoomSessionEnvelope(result)) {
        state.finishFailed = true;
        reviewDom.finishButton.textContent = 'Try again';
        showReviewRoomError(ROOM_COPY.finishFailed);
        return;
    }
    if (applyRoomSessionEnvelope(result)) {
        state.finishFailed = false;
        if (!state.isPaused) {
            navigateTo('focus', 'review');
            renderRoomFocus();
        }
        return;
    }
    await endRoomSession({ saved: result.saved === true });
}

/** Confirm presence: close the popup at once and send the check-in. */
async function handleCheckinConfirm() {
    const state = roomSessionState;
    if (!state.active) return;
    if (state.checkin.dueAtMs !== null) {
        state.checkin.dueAtMs += CHECKIN_INTERVAL_MS;
        state.checkin.deadlineAtMs += CHECKIN_INTERVAL_MS;
    }
    state.checkin.outstanding = false;
    scheduleCheckin();
    const outcome = await enqueueRoomSessionRequest(
        /** Send the check-in event. */
        () => postRoomSessionEvent('checkin')
    );
    await settleRoomSessionOutcome(outcome, ROOM_COPY.sessionErrors.checkin);
}

/** Show or hide the room version of the Review screen. */
export function setReviewRoomMode(enabled) {
    reviewDom.wordmark.hidden = enabled;
    reviewDom.roomName.hidden = !enabled;
    reviewDom.roomSummary.hidden = !enabled;
    if (!enabled) return;
    reviewDom.roomName.textContent = roomSessionState.roomName;
    reviewDom.finishButton.textContent = roomSessionState.finishFailed ? 'Try again' : 'Finish';
}

/** Fill the Review summary cards, or dashes when no summary is available. */
function renderReviewRoomSummary(summary) {
    reviewDom.roomTotalTime.textContent = summary ? formatDurationHoursMinutes(summary.total_time_seconds) : '—';
    reviewDom.roomSessionCount.textContent = summary ? String(summary.total_sessions) : '—';
    reviewDom.roomPeopleCount.textContent = summary ? String(summary.members_count) : '—';
    reviewDom.roomAverageTime.textContent = summary
        ? formatAverageSessionTime(summary.average_session_time_seconds)
        : '—';
}

/** Fill the Review cards at once from the last known room summary plus this session. Return whether it could. */
function renderReviewRoomSummaryFromCache() {
    const cached = roomSnapshotCache.get(roomSessionState.roomId);
    if (!cached) return false;
    const totalSessions = cached.summary.total_sessions + 1;
    const totalTime = cached.summary.total_time_seconds + roomSessionState.display.actualTimeSeconds;
    renderReviewRoomSummary({
        ...cached.summary,
        total_sessions: totalSessions,
        total_time_seconds: totalTime,
        average_session_time_seconds: Math.round(totalTime / totalSessions)
    });
    return true;
}

/** Load the room's summary once, counting the paused session, to correct the Review cards. */
async function loadReviewRoomSummary() {
    const roomId = roomSessionState.roomId;
    try {
        const result = await fetchRoomSummary(roomId, true);
        if (!roomSessionState.active || roomSessionState.roomId !== roomId) return;
        if (!result.success) throw new Error(result.error);
        renderReviewRoomSummary(result.summary);
    } catch (error) {
        if (error.status !== 401) console.error('Could not load the room summary:', error);
    }
}

/** Connect the room session controls and the check-in popup. */
export function initRoomSession() {
    roomDom.startButton.addEventListener('click', handleRoomStartWork);
    [roomDom.mission, roomDom.targetTime].forEach(/** Clear the Start Work error when a field changes. */ (input) => {
        input.addEventListener('input', /** Clear the error under Start Work. */ () => { roomDom.startError.textContent = ''; });
    });
    modalsDom.checkin.confirmButton.addEventListener('click', handleCheckinConfirm);
    modalsDom.checkin.overlay.addEventListener('keydown', /** Keep focus on the only button while the popup is open. */ (event) => {
        if (event.key !== 'Tab') return;
        event.preventDefault();
        modalsDom.checkin.confirmButton.focus();
    });
    document.addEventListener('pointerdown', handleRoomSessionGesture);
    document.addEventListener('keydown', handleRoomSessionGesture);
}
