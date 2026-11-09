// Start the app: restore the sign-in and choose the first screen.

import { refreshAccessToken } from '../auth/http.js';
import { setAuthenticatedUser } from '../auth/identity.js';
import { authState } from '../auth/state.js';
import { initializeDashboardState } from '../dashboard/dashboard.js';
import { fetchRoomSession, postJoinRoom } from '../rooms/api.js';
import { clearJoinHash, getJoinTokenFromHash } from '../rooms/links.js';
import { openRoom, showUnavailableRoom } from '../rooms/room-screen.js';
import {
    applyRoomSessionEnvelope,
    enterRoomSessionFocus,
    isRoomSessionEnvelope,
    timeRoomRequest
} from '../rooms/room-session.js';
import { focusDom } from '../session/dom.js';
import { handleFinishWork } from '../session/review.js';
import { activeSessionState, sessionRuntime } from '../session/state.js';
import { loadActiveSession } from '../session/storage.js';
import { syncOfflineWork } from '../session/sync.js';
import { loadingDom } from '../shared/dom.js';
import { setFloatingMessage } from '../shared/floating-message.js';
import { navigateTo } from '../shared/navigation.js';
import { initializeStreakState, loadStreak } from '../streak/calendar.js';

/** Replace the startup spinner with error feedback and Retry. */
function showLoadingScreenError() {
    loadingDom.screen.classList.add('has-loading-error');
    loadingDom.spinner.style.display = 'none';
    loadingDom.error.style.display = 'flex';
    loadingDom.retryButton.style.display = 'flex';
}

/** Show the startup spinner and hide previous error feedback. */
function showLoadingSpinner() {
    loadingDom.screen.classList.remove('has-loading-error');
    loadingDom.spinner.style.display = 'flex';
    loadingDom.error.style.display = 'none';
    loadingDom.retryButton.style.display = loadingDom.retryButton.disabled ? 'flex' : 'none';
}

/** Restore authentication and route to the appropriate initial screen. */
export async function initializeApp() {
    try {
        const result = await refreshAccessToken();
        setAuthenticatedUser(result);
        initializeDashboardState();
        initializeStreakState();
    } catch (error) {
        showLoadingScreenError();
        return;
    }
    await routeToInitialScreen();
}

/** Restore work or retry a pending Finish after authentication. */
export async function routeToInitialScreen(currentScreen = 'loading') {
    if (!authState.accessToken) {
        navigateTo('register', 'loading');
        return;
    }
    let joinedRoomId = null;
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
            if (error.status === 401) return;
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
        if (error.status === 401) return;
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
export function initStartup() {
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
