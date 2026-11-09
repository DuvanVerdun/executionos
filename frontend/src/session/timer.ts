// The timestamp-based session timer.

import type { ActiveSession } from '../types/session';
import { activeSessionState } from './state';
import { saveActiveSession } from './storage';
import { renderFocusTimer } from './views';

let timerInterval: ReturnType<typeof setInterval> | null = null;

/** Update elapsed time from timestamps and return exact completion percentage. */
function updateElapsedSessionTime(session: ActiveSession): number {
    if (session.pauseStartTimestamp) {
        const elapsed = (Date.now() - new Date(session.pauseStartTimestamp).getTime()) / 1000;
        session.pausedTimeSeconds += elapsed;
        session.pauseStartTimestamp = '';
    }
    session.actualTimeSeconds = Math.floor(
        (Date.now() - new Date(session.startTimestamp).getTime()) / 1000 - session.pausedTimeSeconds
    );
    const exactPercentage = session.actualTimeSeconds / session.targetTimeSeconds * 100;
    session.percentageCompleted = Math.floor(exactPercentage);
    return exactPercentage;
}

/** Start periodic display updates for a running session. */
export function startTimer(session: ActiveSession): void {
    session.isTimerRunning = true;
    timerInterval = setInterval(updateTimer, 1000);
}

/** Refresh and persist the running session's elapsed time. */
function updateTimer(): void {
    if (!activeSessionState.isTimerRunning) return;
    const exactPercentage = updateElapsedSessionTime(activeSessionState);
    renderFocusTimer(activeSessionState, exactPercentage);
    saveActiveSession(activeSessionState);
}

/** Pause display updates and record when the pause began. */
export function pauseSession(session: ActiveSession): void {
    clearInterval(timerInterval ?? undefined);
    session.isTimerRunning = false;
    session.pauseStartTimestamp = new Date().toISOString();
}

/** Account for paused time and restart display updates. */
export function resumeSession(session: ActiveSession): void {
    const elapsed = (Date.now() - new Date(session.pauseStartTimestamp).getTime()) / 1000;
    session.pausedTimeSeconds += elapsed;
    session.pauseStartTimestamp = '';
    startTimer(session);
}

/** Stop the timer and capture the session's final elapsed time. */
export function stopSession(session: ActiveSession): void {
    clearInterval(timerInterval ?? undefined);
    session.isTimerRunning = false;
    const exactPercentage = updateElapsedSessionTime(session);
    renderFocusTimer(session, exactPercentage);
    if (session.actualTimeSeconds >= session.targetTimeSeconds) {
        session.completionStatus = 'completed';
    }
    if (!session.pauseStartTimestamp) {
        session.pauseStartTimestamp = new Date().toISOString();
    }
}

/** Clear the current mission and timing state. */
export function resetSessionState(session: ActiveSession): void {
    session.currentMission = '';
    session.targetTimeSeconds = 0;
    session.actualTimeSeconds = 0;
    session.completionStatus = 'partial';
    session.percentageCompleted = 0;
    session.isTimerRunning = false;
    session.startTimestamp = '';
    session.pauseStartTimestamp = '';
    session.pausedTimeSeconds = 0;
}
