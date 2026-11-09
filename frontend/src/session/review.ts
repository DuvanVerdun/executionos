import { authStore } from '../auth/state';
import { loadDashboard } from '../dashboard/dashboard';
import { errorStatus } from '../lib/errors';
import { waitForMinimumFeedback } from '../lib/timing';
import { handleRoomContinue, handleRoomFinish } from '../rooms/room-session';
import { roomSessionStore } from '../rooms/room-session-state';
import { setFloatingMessage } from '../shared/floating-message';
import { navigateTo } from '../shared/navigation';
import { postSession } from './api';
import { planDraftStore, sessionStore } from './state';
import { clearActiveSession, saveActiveSession, sessionQueue } from './storage';
import { resetSessionState, resumeSession } from './timer';
import { focusStore, reviewStore } from './ui-state';

/** Resume reviewed work when no submission is pending. */
export function handleContinueWork(): void {
    if (roomSessionStore.get().active) {
        void handleRoomContinue();
        return;
    }
    const { isFinishing, pendingSubmission } = sessionStore.get();
    if (isFinishing || pendingSubmission) return;
    reviewStore.update({ saveMessage: '' });
    navigateTo('focus', 'review');
    focusStore.set({ pauseLabel: 'Pause' });
    resumeSession();
}

/** Clear completed work state and reset mission controls. */
function resetApp(): void {
    sessionStore.update({ pendingSubmission: null });
    resetSessionState();
    planDraftStore.set({ mission: '', targetTime: '00:00' });
    try {
        clearActiveSession();
    } catch (error) {
        console.error('Could not clear the saved active session:', error);
    }
}

/** Save or queue the exact submission and show its outcome on Dashboard. */
export async function handleFinishWork(): Promise<void> {
    if (roomSessionStore.get().active) {
        await handleRoomFinish();
        return;
    }
    if (sessionStore.get().isFinishing) return;
    const userId = authStore.get().userId;
    if (userId == null) {
        reviewStore.update({ saveMessage: 'Please sign in before saving this session.' });
        return;
    }
    sessionStore.update({ isFinishing: true });
    const feedbackStartedAt = performance.now();
    reviewStore.update({
        finishLabel: sessionStore.get().pendingSubmission ? 'Retrying…' : 'Saving…',
        saveMessage: ''
    });
    const active = sessionStore.get().active;
    const submission = sessionStore.get().pendingSubmission ?? {
        submissionId: crypto.randomUUID(),
        date: new Date().toISOString(),
        mission: active.currentMission,
        targetTimeSeconds: active.targetTimeSeconds,
        actualTimeSeconds: active.actualTimeSeconds
    };
    sessionStore.update({ pendingSubmission: submission });
    let queued = false;
    let saved = false;
    try {
        try {
            saveActiveSession(sessionStore.get().active);
        } catch (error) {
            console.error('Could not persist the active session:', error);
        }
        try {
            await sessionQueue.add(userId, submission);
            queued = true;
        } catch (error) {
            console.error('Could not queue session:', error);
        }
        if (authStore.get().userId !== userId) return;
        try {
            await postSession(submission, userId);
            if (authStore.get().userId !== userId) return;
            saved = true;
        } catch (error) {
            if (authStore.get().userId !== userId) return;
            console.error('Save error:', error);
            const status = errorStatus(error);
            const rejected = status !== undefined && status >= 400 && status < 500
                && ![401, 403, 408, 429].includes(status);
            if (rejected) {
                if (queued) await sessionQueue.remove(userId, submission.submissionId);
                sessionStore.update({ pendingSubmission: null });
                try {
                    saveActiveSession(sessionStore.get().active);
                } catch (storageError) {
                    console.error('Could not update active session:', storageError);
                }
                reviewStore.update({ saveMessage: 'The server rejected this session. Your work is still here. Try again.' });
                return;
            }
            if (!queued) {
                reviewStore.update({ saveMessage: 'Couldn’t save to the server or browser queue. Your work is still here. Try again.' });
                return;
            }
        }
        if (saved && queued) {
            try {
                await sessionQueue.remove(userId, submission.submissionId);
            } catch (error) {
                console.error('Could not remove synced session:', error);
            }
        }
        await waitForMinimumFeedback(feedbackStartedAt);
        if (authStore.get().userId !== userId) return;
        resetApp();
        navigateTo('dashboard', 'review');
        setFloatingMessage(saved
            ? 'Session saved. Nice work.'
            : 'Saved on this browser. Waiting to sync. Dashboard totals update after syncing.', { saved });
        await loadDashboard();
    } catch (error) {
        console.error('Could not finish session:', error);
        reviewStore.update({ saveMessage: 'Couldn’t finish saving. Your work is still here. Try again.' });
    } finally {
        await waitForMinimumFeedback(feedbackStartedAt);
        sessionStore.update({ isFinishing: false });
        reviewStore.update({ finishLabel: sessionStore.get().pendingSubmission ? 'Try again' : 'Finish' });
    }
}
