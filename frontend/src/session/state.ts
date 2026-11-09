import { createStore } from '../lib/store';
import type { ActiveSession, SessionSubmission } from '../types/session';

interface SessionState {
    active: ActiveSession;
    /** True while the Finish flow runs. */
    isFinishing: boolean;
    /** The finished session that is not confirmed by the server yet. */
    pendingSubmission: SessionSubmission | null;
}

/** An empty session: no mission, no time. */
export function createEmptyActiveSession(): ActiveSession {
    return {
        currentMission: '',
        targetTimeSeconds: 0,
        actualTimeSeconds: 0,
        completionStatus: 'partial',
        percentageCompleted: 0,
        isTimerRunning: false,
        startTimestamp: '',
        pauseStartTimestamp: '',
        pausedTimeSeconds: 0
    };
}

export const sessionStore = createStore<SessionState>({
    active: createEmptyActiveSession(),
    isFinishing: false,
    pendingSubmission: null
});

/** Merge a patch into the active session. */
export function updateActiveSession(patch: Partial<ActiveSession>): void {
    sessionStore.update({ active: { ...sessionStore.get().active, ...patch } });
}

/** What the Plan screen fields hold. They survive a visit to another screen. */
export const planDraftStore = createStore<{ mission: string; targetTime: string }>({
    mission: '',
    targetTime: '00:00'
});
