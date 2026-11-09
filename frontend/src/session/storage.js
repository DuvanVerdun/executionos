// The active session saved in this browser, and the offline queue.

import { authState } from '../auth/state.js';
import { sessionRuntime } from './state.js';

const ACTIVE_SESSION_STORAGE_KEY = 'executionOS_activeSession';

export const sessionQueue = {
    cap: 15,
    /** Return the account-specific browser queue key. */
    storageKey(userId) {
        return `executionOS_sessionQueue:${userId}`;
    },
    /** Read and validate the account's queued submissions. */
    load(userId) {
        const stored = localStorage.getItem(this.storageKey(userId));
        const items = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(items)) throw new Error('Invalid saved session queue');
        return items;
    },
    /** Queue a submission under a cross-tab storage lock. */
    async add(userId, item) {
        await navigator.locks.request(this.storageKey(userId), /** Add a submission while holding its account queue lock. */ () => {
            const items = this.load(userId);
            if (items.some(/** Match an already queued submission by its ID. */ (saved) => saved.submissionId === item.submissionId)) return;
            if (items.length >= this.cap) throw new Error('Session queue is full');
            localStorage.setItem(this.storageKey(userId), JSON.stringify([...items, item]));
        });
    },
    /** Remove a confirmed submission under a cross-tab storage lock. */
    async remove(userId, submissionId) {
        await navigator.locks.request(this.storageKey(userId), /** Remove a submission while holding its account queue lock. */ () => {
            const items = this.load(userId).filter(/** Retain submissions other than the confirmed one. */ (item) => item.submissionId !== submissionId);
            localStorage.setItem(this.storageKey(userId), JSON.stringify(items));
        });
    }
};

/** Persist active session state and its pending submission. */
export function saveActiveSession(session) {
    const activeSession = {
        mission: session.currentMission,
        targetTimeSeconds: session.targetTimeSeconds,
        actualTimeSeconds: session.actualTimeSeconds,
        startTimestamp: session.startTimestamp,
        pauseStartTimestamp: session.pauseStartTimestamp,
        pausedTimeSeconds: session.pausedTimeSeconds,
        userId: authState.userId,
        pendingSubmission: sessionRuntime.pendingSubmission
    };
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(activeSession));
}

/** Restore an eligible active session in a paused state. */
export function loadActiveSession(session) {
    const stored = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!stored) return false;

    const activeSession = JSON.parse(stored);
    if (activeSession.userId != null && activeSession.userId !== authState.userId) return false;
    sessionRuntime.pendingSubmission = activeSession.pendingSubmission ?? null;
    session.currentMission = activeSession.mission;
    session.targetTimeSeconds = activeSession.targetTimeSeconds;
    session.actualTimeSeconds = activeSession.actualTimeSeconds;
    session.startTimestamp = activeSession.startTimestamp;
    session.pauseStartTimestamp = activeSession.pauseStartTimestamp;
    session.pausedTimeSeconds = activeSession.pausedTimeSeconds;
    session.percentageCompleted = Math.floor(session.actualTimeSeconds / session.targetTimeSeconds * 100);
    session.completionStatus = session.actualTimeSeconds >= session.targetTimeSeconds ? 'completed' : 'partial';

    if (!session.pauseStartTimestamp) {
        const startTime = new Date(session.startTimestamp).getTime();
        const lastActiveTime = startTime + (session.actualTimeSeconds + session.pausedTimeSeconds) * 1000;
        session.pauseStartTimestamp = new Date(lastActiveTime).toISOString();
        saveActiveSession(session);
    }
    return true;
}

/** Remove the persisted active session. */
export function clearActiveSession() {
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
}
