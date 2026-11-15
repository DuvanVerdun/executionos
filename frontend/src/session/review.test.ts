import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../auth/state';
import { floatingMessageStore } from '../shared/floating-message';
import { screenStore } from '../shared/navigation';
import { formatLocalDate } from '../lib/dates';
import { continueFromStreakCelebration, streakCelebrationStore } from '../streak/celebration';
import { fakeBackendByPath, jsonBodyOf, pathOf, requestedPaths, type FakeAnswer } from '../test/network';
import { handleContinueWork, handleFinishWork } from './review';
import { planDraftStore, sessionStore, updateActiveSession } from './state';
import { sessionQueue } from './storage';
import { focusStore, reviewStore } from './ui-state';

/** Answer `save-session` with the given answer and every other request with an empty success. */
function backendSaving(answer: FakeAnswer) {
    return fakeBackendByPath(/** Pick the answer for one request. */ (path) => (path === 'save-session' ? answer : { status: 200, body: { success: true } }));
}

/** Run the finish flow to its end, moving the fake clock past the two-second minimum. */
async function finish(): Promise<void> {
    const flow = handleFinishWork();
    await vi.advanceTimersByTimeAsync(5000);
    await flow;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    authStore.set({ accessToken: 'token', userId: 1, username: 'ana' });
    screenStore.set({ screen: 'review' });
    updateActiveSession({ currentMission: 'Write', targetTimeSeconds: 600, actualTimeSeconds: 300 });
});

afterEach(() => {
    vi.useRealTimers();
});

describe('finishing a session', () => {
    it('saves it, clears the work and shows the Dashboard', async () => {
        const fake = backendSaving({ status: 200, body: { success: true, message: 'ok', session_id: 9 } });
        await finish();
        expect(requestedPaths(fake)).toContain('save-session');
        expect(screenStore.get().screen).toBe('dashboard');
        expect(floatingMessageStore.get().message).toBe('Session saved. Nice work.');
        expect(sessionStore.get().active.currentMission).toBe('');
        expect(planDraftStore.get().mission).toBe('');
        expect(sessionQueue.load(1)).toEqual([]);
    });

    it('sends the mission and the times that were on screen', async () => {
        const fake = backendSaving({ status: 200, body: { success: true } });
        await finish();
        const call = fake.mock.calls.find(/** Find the save request. */ ([url]) => pathOf(url) === 'save-session');
        const body = jsonBodyOf(call?.[1]);
        expect(body).toMatchObject({ mission: 'Write', targetTimeSeconds: 600, actualTimeSeconds: 300 });
        expect(typeof body.submissionId).toBe('string');
    });

    it('keeps the session in the browser queue when the network fails', async () => {
        backendSaving(new Error('offline'));
        await finish();
        expect(sessionQueue.load(1)).toHaveLength(1);
        expect(screenStore.get().screen).toBe('dashboard');
        expect(floatingMessageStore.get().message).toMatch(/Saved on this browser/);
    });

    it('keeps the work on Review when the server rejects it', async () => {
        backendSaving({ status: 400, body: { success: false, error: 'Bad' } });
        await finish();
        expect(screenStore.get().screen).toBe('review');
        expect(reviewStore.get().saveMessage).toMatch(/server rejected/);
        expect(sessionQueue.load(1)).toEqual([]);
        expect(sessionStore.get().pendingSubmission).toBeNull();
        expect(sessionStore.get().active.currentMission).toBe('Write');
    });

    it('treats a 429 as a temporary failure, not a rejection', async () => {
        backendSaving({ status: 429, body: { success: false, error: 'Slow down' } });
        await finish();
        expect(sessionQueue.load(1)).toHaveLength(1);
        expect(screenStore.get().screen).toBe('dashboard');
    });

    it('puts the Finish label back after a rejection', async () => {
        backendSaving({ status: 400, body: { success: false, error: 'Bad' } });
        await finish();
        expect(reviewStore.get().finishLabel).toBe('Finish');
    });

    it('asks to sign in when there is no account', async () => {
        authStore.set({ accessToken: null, userId: null, username: '' });
        const fake = backendSaving({ status: 200 });
        await handleFinishWork();
        expect(reviewStore.get().saveMessage).toBe('Please sign in before saving this session.');
        expect(fake).not.toHaveBeenCalled();
    });

    it('ignores a second click while the first is still saving', async () => {
        const fake = backendSaving({ status: 200, body: { success: true } });
        const first = handleFinishWork();
        const second = handleFinishWork();
        await vi.advanceTimersByTimeAsync(5000);
        await Promise.all([first, second]);
        expect(requestedPaths(fake).filter(/** Keep the save requests. */ (path) => path === 'save-session')).toHaveLength(1);
    });
});

describe('finishing the first session of the day', () => {
    /** Answer the save, and the streak route with today as a work day with the given number of sessions. */
    function backendWithStreak(totalSessions: number) {
        const today = formatLocalDate(new Date());
        return fakeBackendByPath(/** Pick the answer for one request. */ (path) => {
            if (path.startsWith('streak')) {
                return {
                    status: 200,
                    body: {
                        success: true, current_streak: 4, total_worked_days: 9, rest_days_remaining_this_week: 2,
                        calendar: { month: today.slice(0, 7), days: [{ date: today, state: 'work', total_sessions: totalSessions, total_time_seconds: 300 }] }
                    }
                };
            }
            return path === 'save-session' ? { status: 200, body: { success: true } } : { status: 500 };
        });
    }

    it('shows the streak screen between Review and the Dashboard, and the Dashboard when the user continues', async () => {
        backendWithStreak(1);
        await finish();
        expect(screenStore.get().screen).toBe('streak');
        expect(streakCelebrationStore.get().celebration).toMatchObject({ from: 3, to: 4 });
        expect(floatingMessageStore.get().message).toBe('');
        continueFromStreakCelebration();
        expect(screenStore.get().screen).toBe('dashboard');
        expect(floatingMessageStore.get().message).toBe('Session saved. Nice work.');
    });

    it('clears the work before the streak screen, so a reload does not bring the session back', async () => {
        backendWithStreak(1);
        await finish();
        expect(sessionStore.get().active.currentMission).toBe('');
    });

    it('goes straight to the Dashboard when it was not the first session of the day', async () => {
        backendWithStreak(2);
        await finish();
        expect(screenStore.get().screen).toBe('dashboard');
        expect(streakCelebrationStore.get().celebration).toBeNull();
    });

    it('goes straight to the Dashboard when the session was only saved on this browser', async () => {
        const fake = backendWithStreak(1);
        backendSaving(new Error('offline'));
        await finish();
        expect(screenStore.get().screen).toBe('dashboard');
        expect(requestedPaths(fake).some(/** Find a streak request. */ (path) => path.startsWith('streak'))).toBe(false);
    });
});

describe('continuing work from Review', () => {
    it('goes back to Focus and runs the timer again', () => {
        screenStore.set({ screen: 'review' });
        updateActiveSession({ startTimestamp: new Date().toISOString(), pauseStartTimestamp: new Date().toISOString() });
        reviewStore.update({ saveMessage: 'old message' });
        handleContinueWork();
        expect(screenStore.get().screen).toBe('focus');
        expect(focusStore.get().pauseLabel).toBe('Pause');
        expect(reviewStore.get().saveMessage).toBe('');
        expect(sessionStore.get().active.isTimerRunning).toBe(true);
        sessionStore.update({ isFinishing: false });
    });

    it('does nothing while a submission is waiting for the server', () => {
        sessionStore.update({ pendingSubmission: { submissionId: 'p', date: 'd', mission: 'm', targetTimeSeconds: 1, actualTimeSeconds: 1 } });
        handleContinueWork();
        expect(screenStore.get().screen).toBe('review');
    });
});
