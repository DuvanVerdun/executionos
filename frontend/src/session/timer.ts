import type { ActiveSession } from '../types/session';
import { createEmptyActiveSession, sessionStore, updateActiveSession } from './state';
import { saveActiveSession } from './storage';

let timerInterval: ReturnType<typeof setInterval> | null = null;

/** Return the session with its elapsed time and completion percentage updated from timestamps. */
function withElapsedTime(session: ActiveSession): ActiveSession {
    let pausedTimeSeconds = session.pausedTimeSeconds;
    if (session.pauseStartTimestamp) {
        const elapsed = (Date.now() - new Date(session.pauseStartTimestamp).getTime()) / 1000;
        pausedTimeSeconds += elapsed;
    }
    const actualTimeSeconds = Math.floor(
        (Date.now() - new Date(session.startTimestamp).getTime()) / 1000 - pausedTimeSeconds
    );
    return {
        ...session,
        pausedTimeSeconds,
        pauseStartTimestamp: '',
        actualTimeSeconds,
        percentageCompleted: Math.floor(actualTimeSeconds / session.targetTimeSeconds * 100)
    };
}

/** Start periodic display updates for a running session. */
export function startTimer(): void {
    updateActiveSession({ isTimerRunning: true });
    timerInterval = setInterval(updateTimer, 1000);
}

/** Refresh and persist the running session's elapsed time. */
function updateTimer(): void {
    const session = sessionStore.get().active;
    if (!session.isTimerRunning) return;
    const updated = withElapsedTime(session);
    updateActiveSession(updated);
    saveActiveSession(updated);
}

/** Pause display updates and record when the pause began. */
export function pauseSession(): void {
    clearInterval(timerInterval ?? undefined);
    updateActiveSession({ isTimerRunning: false, pauseStartTimestamp: new Date().toISOString() });
}

/** Account for paused time and restart display updates. */
export function resumeSession(): void {
    const session = sessionStore.get().active;
    const elapsed = (Date.now() - new Date(session.pauseStartTimestamp).getTime()) / 1000;
    updateActiveSession({ pausedTimeSeconds: session.pausedTimeSeconds + elapsed, pauseStartTimestamp: '' });
    startTimer();
}

/** Stop the timer and capture the session's final elapsed time. */
export function stopSession(): void {
    clearInterval(timerInterval ?? undefined);
    const updated = withElapsedTime({ ...sessionStore.get().active, isTimerRunning: false });
    updateActiveSession({
        ...updated,
        completionStatus: updated.actualTimeSeconds >= updated.targetTimeSeconds ? 'completed' : updated.completionStatus,
        pauseStartTimestamp: new Date().toISOString()
    });
}

/** Clear the current mission and timing state. */
export function resetSessionState(): void {
    sessionStore.update({ active: createEmptyActiveSession() });
}
