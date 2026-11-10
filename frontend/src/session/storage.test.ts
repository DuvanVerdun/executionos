import { describe, expect, it } from 'vitest';
import { authStore } from '../auth/state';
import type { SessionSubmission } from '../types/session';
import { sessionStore, updateActiveSession } from './state';
import { clearActiveSession, loadActiveSession, saveActiveSession, sessionQueue } from './storage';

/** Make a submission with the given ID. */
function submission(submissionId: string): SessionSubmission {
    return { submissionId, date: '2026-11-09T12:00:00.000Z', mission: 'Write', targetTimeSeconds: 600, actualTimeSeconds: 300 };
}

describe('sessionQueue', () => {
    it('starts empty', () => {
        expect(sessionQueue.load(1)).toEqual([]);
    });

    it('keeps submissions in the order they were added', async () => {
        await sessionQueue.add(1, submission('a'));
        await sessionQueue.add(1, submission('b'));
        expect(sessionQueue.load(1).map(/** Read the ID of a submission. */ (item) => item.submissionId)).toEqual(['a', 'b']);
    });

    it('ignores a submission that is already queued', async () => {
        await sessionQueue.add(1, submission('a'));
        await sessionQueue.add(1, submission('a'));
        expect(sessionQueue.load(1)).toHaveLength(1);
    });

    it('keeps one queue for each account', async () => {
        await sessionQueue.add(1, submission('a'));
        await sessionQueue.add(2, submission('b'));
        expect(sessionQueue.load(1)).toHaveLength(1);
        expect(sessionQueue.load(2)[0]?.submissionId).toBe('b');
    });

    it('removes only the confirmed submission', async () => {
        await sessionQueue.add(1, submission('a'));
        await sessionQueue.add(1, submission('b'));
        await sessionQueue.remove(1, 'a');
        expect(sessionQueue.load(1).map(/** Read the ID of a submission. */ (item) => item.submissionId)).toEqual(['b']);
    });

    it('refuses a 16th submission', async () => {
        for (let index = 0; index < 15; index += 1) await sessionQueue.add(1, submission(`s${index}`));
        await expect(sessionQueue.add(1, submission('one-too-many'))).rejects.toThrow('Session queue is full');
    });

    it('refuses saved data that is not a list', () => {
        localStorage.setItem(sessionQueue.storageKey(1), '{"not":"a list"}');
        expect(() => sessionQueue.load(1)).toThrow('Invalid saved session queue');
    });
});

describe('the active session in the browser', () => {
    it('is not restored when nothing was saved', () => {
        expect(loadActiveSession()).toBe(false);
    });

    it('saves and restores a paused session with its progress', () => {
        authStore.update({ userId: 1 });
        updateActiveSession({
            currentMission: 'Write', targetTimeSeconds: 600, actualTimeSeconds: 120, pausedTimeSeconds: 30,
            startTimestamp: '2026-11-09T12:00:00.000Z', pauseStartTimestamp: '2026-11-09T12:02:30.000Z'
        });
        saveActiveSession(sessionStore.get().active);
        updateActiveSession({ currentMission: '', actualTimeSeconds: 0 });

        expect(loadActiveSession()).toBe(true);
        expect(sessionStore.get().active).toMatchObject({
            currentMission: 'Write', targetTimeSeconds: 600, actualTimeSeconds: 120, percentageCompleted: 20,
            completionStatus: 'partial', pauseStartTimestamp: '2026-11-09T12:02:30.000Z'
        });
    });

    it('works out when a running session stopped, if the page closed while it ran', () => {
        authStore.update({ userId: 1 });
        updateActiveSession({
            currentMission: 'Write', targetTimeSeconds: 600, actualTimeSeconds: 100, pausedTimeSeconds: 20,
            startTimestamp: '2026-11-09T12:00:00.000Z', pauseStartTimestamp: ''
        });
        saveActiveSession(sessionStore.get().active);
        loadActiveSession();
        expect(sessionStore.get().active.pauseStartTimestamp).toBe('2026-11-09T12:02:00.000Z');
    });

    it('marks a restored session completed when it reached its target', () => {
        authStore.update({ userId: 1 });
        updateActiveSession({ targetTimeSeconds: 60, actualTimeSeconds: 90, startTimestamp: '2026-11-09T12:00:00.000Z', pauseStartTimestamp: 'x' });
        saveActiveSession(sessionStore.get().active);
        loadActiveSession();
        expect(sessionStore.get().active.completionStatus).toBe('completed');
    });

    it('does not restore a session saved for another account', () => {
        authStore.update({ userId: 1 });
        updateActiveSession({ currentMission: 'Mine', targetTimeSeconds: 60, startTimestamp: '2026-11-09T12:00:00.000Z' });
        saveActiveSession(sessionStore.get().active);
        authStore.update({ userId: 2 });
        expect(loadActiveSession()).toBe(false);
    });

    it('restores the submission that still waits for the server', () => {
        authStore.update({ userId: 1 });
        sessionStore.update({ pendingSubmission: submission('p') });
        updateActiveSession({ targetTimeSeconds: 60, startTimestamp: '2026-11-09T12:00:00.000Z', pauseStartTimestamp: 'x' });
        saveActiveSession(sessionStore.get().active);
        sessionStore.update({ pendingSubmission: null });
        loadActiveSession();
        expect(sessionStore.get().pendingSubmission?.submissionId).toBe('p');
    });

    it('forgets the saved session when cleared', () => {
        updateActiveSession({ targetTimeSeconds: 60, startTimestamp: '2026-11-09T12:00:00.000Z' });
        saveActiveSession(sessionStore.get().active);
        clearActiveSession();
        expect(loadActiveSession()).toBe(false);
    });
});
