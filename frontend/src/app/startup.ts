// Start the app: restore the sign-in and choose the first screen.

import { refreshAccessToken } from '../auth/http';
import { setAuthenticatedUser } from '../auth/identity';
import { authState } from '../auth/state';
import { initializeDashboardState } from '../dashboard/dashboard';
import { fetchRoomSession, postJoinRoom } from '../rooms/api';
import { clearJoinHash, getJoinTokenFromHash } from '../rooms/links';
import { openRoom, showUnavailableRoom } from '../rooms/room-screen';
import {
    applyRoomSessionEnvelope,
    enterRoomSessionFocus,
    isRoomSessionEnvelope,
    timeRoomRequest
} from '../rooms/room-session';
import { focusDom } from '../session/dom';
import { handleFinishWork } from '../session/review';
import { activeSessionState, sessionRuntime } from '../session/state';
import { loadActiveSession } from '../session/storage';
import { syncOfflineWork } from '../session/sync';
import { errorStatus } from '../lib/errors';
import { loadingDom } from '../shared/dom';
import { setFloatingMessage } from '../shared/floating-message';
import { navigateTo } from '../shared/navigation';
import { initializeStreakState, loadStreak } from '../streak/calendar';
import type { ScreenName } from '../types/screens';

/** Replace the startup spinner with error feedback and Retry. */
function showLoadingScreenError(): void {
    loadingDom.screen.classList.add('has-loading-error');
    loadingDom.spinner.style.display = 'none';
    loadingDom.error.style.display = 'flex';
    loadingDom.retryButton.style.display = 'flex';
}

/** Show the startup spinner and hide previous error feedback. */
function showLoadingSpinner(): void {
    loadingDom.screen.classList.remove('has-loading-error');
    loadingDom.spinner.style.display = 'flex';
    loadingDom.error.style.display = 'none';
    loadingDom.retryButton.style.display = loadingDom.retryButton.disabled ? 'flex' : 'none';
}

/** Restore authentication and route to the appropriate initial screen. */
export async function initializeApp(): Promise<void> {
    try {
        const result = await refreshAccessToken();
        if (result) setAuthenticatedUser(result);
        initializeDashboardState();
        initializeStreakState();
    } catch (error) {
        showLoadingScreenError();
        return;
    }
    await routeToInitialScreen();
}

/** Restore work or retry a pending Finish after authentication. */
export async function routeToInitialScreen(currentScreen: ScreenName = 'loading'): Promise<void> {
    if (!authState.accessToken) {
        navigateTo('register', 'loading');
        return;
    }
    let joinedRoomId: number | null = null;
    let joinUnavailable = false;
    const joinToken = getJoinTokenFromHash();
    if (joinToken !== null) {
        try {
            const joinResult = await postJoinRoom(joinToken, currentScreen);
            if (joinResult.success === true) {
                joinedRoomId = joinResult.room.id;
            } else if (joinResult.status === 400 || joinResult.status === 404) {
                joinUnavailable = true;
            } else {
                throw new Error(joinResult.error || 'Could not join the room');
            }
            clearJoinHash();
        } catch (error) {
            if (errorStatus(error) === 401) return;
            console.error('Could not join the room:', error);
            navigateTo('loading', currentScreen);
            showLoadingScreenError();
            return;
        }
    }
    try {
        const { result: roomSessionResult, sentAtMs, receivedAtMs } = await timeRoomRequest(
            /** Request the running room session. */
            () => fetchRoomSession(currentScreen)
        );
        if (roomSessionResult.status !== 200 || !isRoomSessionEnvelope(roomSessionResult)) {
            throw new Error(roomSessionResult.error || 'Could not load the room session');
        }
        if (applyRoomSessionEnvelope(roomSessionResult, sentAtMs, receivedAtMs)) {
            enterRoomSessionFocus(currentScreen);
            return;
        }
    } catch (error) {
        if (errorStatus(error) === 401) return;
        console.error('Could not load the room session:', error);
        navigateTo('loading', currentScreen);
        showLoadingScreenError();
        return;
    }
    let restoredSession = false;
    try {
        restoredSession = loadActiveSession(activeSessionState);
    } catch (error) {
        console.error('Could not restore the active session:', error);
        setFloatingMessage('Couldn’t restore browser saves. Please reload to try again.');
    }
    if (restoredSession && sessionRuntime.pendingSubmission) {
        navigateTo('review', currentScreen);
        await handleFinishWork();
        return;
    }
    void syncOfflineWork();
    if (!restoredSession) {
        if (joinedRoomId !== null) {
            await openRoom(joinedRoomId, currentScreen);
            return;
        }
        if (joinUnavailable) {
            showUnavailableRoom(currentScreen);
            return;
        }
        navigateTo('plan', currentScreen);
        await loadStreak('plan');
        return;
    }
    navigateTo('focus', currentScreen);
    focusDom.pauseButton.textContent = 'Resume';
}

/** Connect the Loading screen retry button. */
export function initStartup(): void {
    loadingDom.retryButton.addEventListener('click', /** Retry application initialization. */ async () => {
        if (loadingDom.retryButton.disabled) return;
        loadingDom.retryButton.disabled = true;
        loadingDom.retryButton.textContent = 'Retrying…';
        showLoadingSpinner();
        try {
            await initializeApp();
        } finally {
            loadingDom.retryButton.disabled = false;
            loadingDom.retryButton.textContent = 'Retry';
        }
    });
}
