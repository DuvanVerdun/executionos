import { authStore } from '../auth/state';
import type { ActiveSession, SessionSubmission, StoredActiveSession } from '../types/session';
import { sessionStore, updateActiveSession } from './state';

const ACTIVE_SESSION_STORAGE_KEY = 'executionOS_activeSession';

export const sessionQueue = {
    cap: 15,
    /** Return the account-specific browser queue key. */
    storageKey(userId: number): string {
        return `executionOS_sessionQueue:${userId}`;
    },
    /** Read the account's queued submissions. Only this app writes the queue, so its items are trusted. */
    load(userId: number): SessionSubmission[] {
        const stored = localStorage.getItem(this.storageKey(userId));
        const items: unknown = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(items)) throw new Error('Invalid saved session queue');
        return items as SessionSubmission[];
    },
    /** Queue a submission under a cross-tab storage lock. */
    async add(userId: number, item: SessionSubmission): Promise<void> {
        await navigator.locks.request(this.storageKey(userId), /** Add a submission while holding its account queue lock. */ () => {
            const items = this.load(userId);
            if (items.some(/** Match an already queued submission by its ID. */ (saved) => saved.submissionId === item.submissionId)) return;
            if (items.length >= this.cap) throw new Error('Session queue is full');
            localStorage.setItem(this.storageKey(userId), JSON.stringify([...items, item]));
        });
    },
    /** Remove a confirmed submission under a cross-tab storage lock. */
    async remove(userId: number, submissionId: string): Promise<void> {
        await navigator.locks.request(this.storageKey(userId), /** Remove a submission while holding its account queue lock. */ () => {
            const items = this.load(userId).filter(/** Retain submissions other than the confirmed one. */ (item) => item.submissionId !== submissionId);
            localStorage.setItem(this.storageKey(userId), JSON.stringify(items));
        });
    }
};

/** Persist active session state and its pending submission. */
export function saveActiveSession(session: ActiveSession): void {
    const activeSession: StoredActiveSession = {
        mission: session.currentMission,
        targetTimeSeconds: session.targetTimeSeconds,
        actualTimeSeconds: session.actualTimeSeconds,
        startTimestamp: session.startTimestamp,
        pauseStartTimestamp: session.pauseStartTimestamp,
        pausedTimeSeconds: session.pausedTimeSeconds,
        userId: authStore.get().userId,
        pendingSubmission: sessionStore.get().pendingSubmission
    };
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(activeSession));
}

/** Restore an eligible active session in a paused state. Only this app writes it, so its shape is trusted. */
export function loadActiveSession(): boolean {
    const stored = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!stored) return false;
    const activeSession = JSON.parse(stored) as StoredActiveSession;
    if (activeSession.userId != null && activeSession.userId !== authStore.get().userId) return false;
    sessionStore.update({ pendingSubmission: activeSession.pendingSubmission ?? null });
    const actualTimeSeconds = activeSession.actualTimeSeconds;
    const targetTimeSeconds = activeSession.targetTimeSeconds;
    updateActiveSession({
        currentMission: activeSession.mission,
        targetTimeSeconds,
        actualTimeSeconds,
        startTimestamp: activeSession.startTimestamp,
        pauseStartTimestamp: activeSession.pauseStartTimestamp,
        pausedTimeSeconds: activeSession.pausedTimeSeconds,
        percentageCompleted: Math.floor(actualTimeSeconds / targetTimeSeconds * 100),
        completionStatus: actualTimeSeconds >= targetTimeSeconds ? 'completed' : 'partial'
    });
    if (!activeSession.pauseStartTimestamp) {
        const startTime = new Date(activeSession.startTimestamp).getTime();
        const lastActiveTime = startTime + (actualTimeSeconds + activeSession.pausedTimeSeconds) * 1000;
        updateActiveSession({ pauseStartTimestamp: new Date(lastActiveTime).toISOString() });
        saveActiveSession(sessionStore.get().active);
    }
    return true;
}

/** Remove the persisted active session. */
export function clearActiveSession(): void {
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
}
