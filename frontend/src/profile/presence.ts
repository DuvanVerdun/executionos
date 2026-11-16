import { authStore } from '../auth/state';
import { HEARTBEAT_INTERVAL_MS } from '../config';
import { roomSessionStore } from '../rooms/room-session-state';
import { sessionStore } from '../session/state';
import type { PresenceReport } from '../types/social';
import { deletePresence, putPresence } from './api';

/** Whether the server knows about a session of this device, and what the last report said besides the time. */
let reportedKey: string | null = null;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/** The requests wait for each other, so a late report can never arrive after the end of the session. */
let queueTail: Promise<unknown> = Promise.resolve();

let stopSubscriptions: (() => void) | null = null;

/** Return what this device knows about the running session, personal or room, or null when there is none. Review counts as paused. */
export function currentReport(): PresenceReport | null {
    const room = roomSessionStore.get();
    if (room.active) {
        return {
            state: room.isPaused ? 'paused' : 'working',
            mission: room.display.currentMission,
            workedSeconds: room.display.actualTimeSeconds,
            targetSeconds: room.display.targetTimeSeconds
        };
    }
    const personal = sessionStore.get().active;
    if (personal.startTimestamp === '') return null;
    return {
        state: personal.isTimerRunning ? 'working' : 'paused',
        mission: personal.currentMission,
        workedSeconds: personal.actualTimeSeconds,
        targetSeconds: personal.targetTimeSeconds
    };
}

/** Return what identifies a session and its state: a change in it is reported at once, and the time is only reported with the heartbeat. */
function keyOf(report: PresenceReport): string {
    return `${report.state}|${report.targetSeconds}|${report.mission}`;
}

/** Run a request after the ones before it, and never fail: the live state is a courtesy, and the session does not depend on it. */
function enqueue(request: () => Promise<unknown>): void {
    queueTail = queueTail.then(request).catch(/** Leave the failure in the console. */ (error: unknown) => {
        console.error('Presence report failed:', error);
    });
}

/** Report the running session again, with the time worked now. */
function sendHeartbeat(): void {
    const report = currentReport();
    if (report !== null) enqueue(() => putPresence(report));
}

/** Report every 15 seconds, so the server knows that the session goes on. */
function startHeartbeat(): void {
    heartbeatTimer ??= setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}

/** Stop reporting. */
function stopHeartbeat(): void {
    clearInterval(heartbeatTimer ?? undefined);
    heartbeatTimer = null;
}

/** Report a change in the session, and tell the server when the session ended. */
function reconcile(): void {
    const signedIn = authStore.get().accessToken !== null;
    const report = signedIn ? currentReport() : null;
    if (report === null) {
        stopHeartbeat();
        if (reportedKey !== null && signedIn) enqueue(deletePresence);
        reportedKey = null;
        return;
    }
    startHeartbeat();
    const key = keyOf(report);
    if (key === reportedKey) return;
    reportedKey = key;
    enqueue(() => putPresence(report));
}

/**
 * Tell the server what the user's session is doing, so the people who follow them can see it.
 * The client stays the authority: it counts the time and only sends what it has, and nothing waits for the answer.
 */
export function startPresenceReporting(): void {
    stopPresenceReporting();
    const stops = [authStore, sessionStore, roomSessionStore].map(/** Report on every change of one store. */ (store) => store.subscribe(reconcile));
    stopSubscriptions = () => {
        stops.forEach(/** Stop listening to one store. */ (stop) => { stop(); });
    };
    reconcile();
}

/** Stop reporting and forget what was reported. */
export function stopPresenceReporting(): void {
    stopSubscriptions?.();
    stopSubscriptions = null;
    stopHeartbeat();
    reportedKey = null;
}
