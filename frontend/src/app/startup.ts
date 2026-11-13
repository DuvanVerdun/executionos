import { refreshAccessToken } from '../auth/http';
import { setAuthenticatedUser } from '../auth/identity';
import { authStore } from '../auth/state';
import { initializeDashboardState } from '../dashboard/dashboard';
import { t } from '../i18n/i18n';
import { errorStatus } from '../lib/errors';
import { createStore } from '../lib/store';
import { fetchRoomSession, postJoinRoom } from '../rooms/api';
import { clearJoinHash, getJoinTokenFromHash } from '../rooms/links';
import { openRoom, showUnavailableRoom } from '../rooms/room';
import {
    applyRoomSessionEnvelope,
    enterRoomSessionFocus,
    isRoomSessionEnvelope
} from '../rooms/room-session';
import { handleFinishWork } from '../session/review';
import { sessionStore } from '../session/state';
import { loadActiveSession } from '../session/storage';
import { syncOfflineWork } from '../session/sync';
import { focusStore } from '../session/ui-state';
import { setFloatingMessage } from '../shared/floating-message';
import { goToHeaderScreen } from '../shared/header-navigation';
import { loadLastScreen } from '../shared/last-screen';
import { navigateTo } from '../shared/navigation';
import { initializeStreakState, loadStreak } from '../streak/streak';
import type { ScreenName } from '../types/screens';

/** What the Loading screen shows: the spinner, or the error with its Retry button. */
export const loadingStore = createStore<{ hasError: boolean; isRetrying: boolean }>({
    hasError: false,
    isRetrying: false
});

/** Replace the startup spinner with error feedback and Retry. */
function showLoadingScreenError(): void {
    loadingStore.update({ hasError: true });
}

/** Restore authentication and route to the appropriate initial screen. */
export async function initializeApp(): Promise<void> {
    try {
        const result = await refreshAccessToken();
        if (result) setAuthenticatedUser(result);
        initializeDashboardState();
        initializeStreakState();
    } catch {
        showLoadingScreenError();
        return;
    }
    await routeToInitialScreen();
}

/** Retry application initialization from the Loading screen. */
export async function retryInitialization(): Promise<void> {
    if (loadingStore.get().isRetrying) return;
    loadingStore.set({ hasError: false, isRetrying: true });
    try {
        await initializeApp();
    } finally {
        loadingStore.update({ isRetrying: false });
    }
}

/** Open the screen or room that the user had before a reload. Open Plan when there is none. */
async function openLastScreen(userId: number, currentScreen: ScreenName): Promise<void> {
    const place = loadLastScreen(userId);
    if (place?.screen === 'room') {
        await openRoom(place.roomId, currentScreen);
    } else if (place !== null && place.screen !== 'plan') {
        await goToHeaderScreen(place.screen, currentScreen);
    } else {
        navigateTo('plan', currentScreen);
        await loadStreak('plan');
    }
}

/** Restore work or retry a pending Finish after authentication. Nobody signed in sees the Landing, or Register when they come with a room link. */
export async function routeToInitialScreen(currentScreen: ScreenName = 'loading'): Promise<void> {
    const { accessToken, userId } = authStore.get();
    if (!accessToken || userId === null) {
        navigateTo(getJoinTokenFromHash() === null ? 'landing' : 'register', 'loading');
        return;
    }
    let joinedRoomId: number | null = null;
    let joinUnavailable = false;
    const joinToken = getJoinTokenFromHash();
    if (joinToken !== null) {
        try {
            const joinResult = await postJoinRoom(joinToken, currentScreen);
            if (joinResult.success) {
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
        const roomSessionResult = await fetchRoomSession(currentScreen);
        if (roomSessionResult.status !== 200 || !isRoomSessionEnvelope(roomSessionResult)) {
            throw new Error(roomSessionResult.error || 'Could not load the room session');
        }
        if (applyRoomSessionEnvelope(roomSessionResult)) {
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
        restoredSession = loadActiveSession();
    } catch (error) {
        console.error('Could not restore the active session:', error);
        setFloatingMessage(t('startup.restoreFailed'));
    }
    if (restoredSession && sessionStore.get().pendingSubmission) {
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
        await openLastScreen(userId, currentScreen);
        return;
    }
    navigateTo('focus', currentScreen);
    focusStore.set({ pauseLabel: 'Resume' });
}
