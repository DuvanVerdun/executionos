// Review screen: continue, finish and save.

import { authState } from '../auth/state.js';
import { loadDashboard } from '../dashboard/dashboard.js';
import { waitForMinimumFeedback } from '../lib/timing.js';
import { handleRoomContinue, handleRoomFinish } from '../rooms/room-session.js';
import { roomSessionState } from '../rooms/state.js';
import { setFloatingMessage } from '../shared/floating-message.js';
import { navigateTo } from '../shared/navigation.js';
import { postSession } from './api.js';
import { focusDom, planDom, reviewDom } from './dom.js';
import { activeSessionState, sessionRuntime } from './state.js';
import { clearActiveSession, saveActiveSession, sessionQueue } from './storage.js';
import { resetSessionState, resumeSession } from './timer.js';

/** Resume reviewed work when no submission is pending. */
function handleContinueWork() {
    if (roomSessionState.active) {
        void handleRoomContinue();
        return;
    }
    if (sessionRuntime.isFinishing || sessionRuntime.pendingSubmission) return;
    reviewDom.saveMessage.textContent = '';
    navigateTo('focus', 'review');
    focusDom.pauseButton.textContent = 'Pause';
    resumeSession(activeSessionState);
}

/** Clear completed work state and reset mission controls. */
function resetApp() {
    sessionRuntime.pendingSubmission = null;
    resetSessionState(activeSessionState);
    planDom.mission.value = '';
    planDom.targetTime.value = '00:00';
    focusDom.currentTime.textContent = '00:00:00';
    focusDom.timerRing.style.setProperty('--pct', '0%');
    try {
        clearActiveSession();
    } catch (error) {
        console.error('Could not clear the saved active session:', error);
    }
    reviewDom.continueButton.classList.replace('normal-button', 'cta-button');
}

/** Save or queue the exact submission and show its outcome on Dashboard. */
export async function handleFinishWork() {
    if (roomSessionState.active) {
        await handleRoomFinish();
        return;
    }
    if (sessionRuntime.isFinishing) return;
    const userId = authState.userId;
    if (userId == null) {
        reviewDom.saveMessage.textContent = 'Please sign in before saving this session.';
        return;
    }
    sessionRuntime.isFinishing = true;
    const feedbackStartedAt = performance.now();
    reviewDom.finishButton.disabled = true;
    reviewDom.continueButton.disabled = true;
    reviewDom.finishButton.textContent = sessionRuntime.pendingSubmission ? 'Retrying…' : 'Saving…';
    reviewDom.screen.setAttribute('aria-busy', 'true');
    reviewDom.saveMessage.textContent = '';
    sessionRuntime.pendingSubmission ??= {
        submissionId: crypto.randomUUID(),
        date: new Date().toISOString(),
        mission: activeSessionState.currentMission,
        targetTimeSeconds: activeSessionState.targetTimeSeconds,
        actualTimeSeconds: activeSessionState.actualTimeSeconds
    };
    let queued = false;
    let saved = false;
    try {

        try {
            saveActiveSession(activeSessionState);
        } catch (error) {
            console.error('Could not persist the active session:', error);
        }
        try {
            await sessionQueue.add(userId, sessionRuntime.pendingSubmission);
            queued = true;
        } catch (error) {
            console.error('Could not queue session:', error);
        }
        if (authState.userId !== userId) return;
        try {
            await postSession(sessionRuntime.pendingSubmission, userId);
            if (authState.userId !== userId) return;
            saved = true;
        } catch (error) {
            if (authState.userId !== userId) return;
            console.error('Save error:', error);
            const rejected = error.status >= 400 && error.status < 500
                && ![401, 403, 408, 429].includes(error.status);
            if (rejected) {
                if (queued) await sessionQueue.remove(userId, sessionRuntime.pendingSubmission.submissionId);
                sessionRuntime.pendingSubmission = null;
                try {
                    saveActiveSession(activeSessionState);
                } catch (storageError) {
                    console.error('Could not update active session:', storageError);
                }
                reviewDom.saveMessage.textContent = 'The server rejected this session. Your work is still here. Try again.';
                return;
            }
            if (!queued) {
                reviewDom.saveMessage.textContent = 'Couldn’t save to the server or browser queue. Your work is still here. Try again.';
                return;
            }
        }
        if (saved && queued) {
            try {
                await sessionQueue.remove(userId, sessionRuntime.pendingSubmission.submissionId);
            } catch (error) {

                console.error('Could not remove synced session:', error);
            }
        }
        await waitForMinimumFeedback(feedbackStartedAt);
        if (authState.userId !== userId) return;
        resetApp();
        navigateTo('dashboard', 'review');
        setFloatingMessage(saved
            ? 'Session saved. Nice work.'
            : 'Saved on this browser. Waiting to sync. Dashboard totals update after syncing.', { saved });
        await loadDashboard();
    } catch (error) {
        console.error('Could not finish session:', error);
        reviewDom.saveMessage.textContent = 'Couldn’t finish saving. Your work is still here. Try again.';
    } finally {
        await waitForMinimumFeedback(feedbackStartedAt);
        sessionRuntime.isFinishing = false;
        reviewDom.finishButton.disabled = false;
        reviewDom.continueButton.disabled = sessionRuntime.pendingSubmission !== null;
        reviewDom.finishButton.textContent = sessionRuntime.pendingSubmission ? 'Try again' : 'Finish';
        reviewDom.screen.removeAttribute('aria-busy');
    }
}

/** Connect the Review screen controls. */
export function initReview() {
    reviewDom.continueButton.addEventListener('click', handleContinueWork);
    reviewDom.finishButton.addEventListener('click', handleFinishWork);
}
