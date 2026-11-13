import { millisecondsUntilNextSecond } from '../lib/timing';
import type { ActiveSession } from '../types/session';
import { createEmptyActiveSession, sessionStore, updateActiveSession } from './state';
import { saveActiveSession } from './storage';

let tickTimer: ReturnType<typeof setTimeout> | null = null;

/** Return the seconds worked, with decimals, at the given moment. Pauses that were already counted are left out. */
function exactElapsedSeconds(session: ActiveSession, pausedTimeSeconds: number, nowMs: number): number {
    return (nowMs - new Date(session.startTimestamp).getTime()) / 1000 - pausedTimeSeconds;
}

/** Return the session with its elapsed time and completion percentage updated from timestamps, as of one moment. */
function withElapsedTime(session: ActiveSession, nowMs: number): ActiveSession {
    let pausedTimeSeconds = session.pausedTimeSeconds;
    if (session.pauseStartTimestamp) {
        pausedTimeSeconds += (nowMs - new Date(session.pauseStartTimestamp).getTime()) / 1000;
    }
    const actualTimeSeconds = Math.max(0, Math.floor(exactElapsedSeconds(session, pausedTimeSeconds, nowMs)));
    return {
        ...session,
        pausedTimeSeconds,
        pauseStartTimestamp: '',
        actualTimeSeconds,
        percentageCompleted: Math.floor(actualTimeSeconds / session.targetTimeSeconds * 100)
    };
}

/** Cancel the wait for the next tick. */
function cancelTick(): void {
    clearTimeout(tickTimer ?? undefined);
    tickTimer = null;
}

/** Wake up exactly when the shown second changes, so the number is never behind the clock. */
function scheduleTick(): void {
    cancelTick();
    const session = sessionStore.get().active;
    if (!session.isTimerRunning) return;
    const exactSeconds = exactElapsedSeconds(session, session.pausedTimeSeconds, Date.now());
    tickTimer = setTimeout(tick, millisecondsUntilNextSecond(exactSeconds));
}

/** Show the time at this moment, save the session, and wait for the next second. */
function tick(): void {
    refreshElapsedTime();
    scheduleTick();
}

/** Show and save the running session's elapsed time at this moment. */
function refreshElapsedTime(): void {
    const session = sessionStore.get().active;
    if (!session.isTimerRunning) return;
    const updated = withElapsedTime(session, Date.now());
    updateActiveSession(updated);
    saveActiveSession(updated);
}

/**
 * Bring the shown time up to date and aim the next tick again.
 * Use it when the page may have been asleep: a hidden tab runs its timers late.
 */
export function catchUpTimer(): void {
    refreshElapsedTime();
    scheduleTick();
}

/** Start the timer of the active session. The time shows at once, and then once per second. */
export function startTimer(): void {
    updateActiveSession({ isTimerRunning: true });
    catchUpTimer();
}

/** Stop the display updates and record the exact moment the pause began. The number on screen is the time at that moment. */
export function pauseSession(): void {
    cancelTick();
    const session = sessionStore.get().active;
    if (!session.isTimerRunning) return;
    const nowMs = Date.now();
    updateActiveSession({
        ...withElapsedTime(session, nowMs),
        isTimerRunning: false,
        pauseStartTimestamp: new Date(nowMs).toISOString()
    });
}

/** Account for paused time and restart display updates. */
export function resumeSession(): void {
    const session = sessionStore.get().active;
    const pausedSinceMs = Date.parse(session.pauseStartTimestamp);
    const pausedForSeconds = Number.isNaN(pausedSinceMs) ? 0 : (Date.now() - pausedSinceMs) / 1000;
    updateActiveSession({ pausedTimeSeconds: session.pausedTimeSeconds + pausedForSeconds, pauseStartTimestamp: '' });
    startTimer();
}

/** Stop the timer and capture the session's final elapsed time. */
export function stopSession(): void {
    cancelTick();
    const nowMs = Date.now();
    const updated = withElapsedTime({ ...sessionStore.get().active, isTimerRunning: false }, nowMs);
    updateActiveSession({
        ...updated,
        completionStatus: updated.actualTimeSeconds >= updated.targetTimeSeconds ? 'completed' : updated.completionStatus,
        pauseStartTimestamp: new Date(nowMs).toISOString()
    });
    saveActiveSession(sessionStore.get().active);
}

/** Clear the current mission and timing state. */
export function resetSessionState(): void {
    cancelTick();
    sessionStore.update({ active: createEmptyActiveSession() });
}
