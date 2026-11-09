// The steps that run when screens change, in the order they must run.

import { loginDom } from '../auth/dom';
import { setLoginRequiredHandler } from '../auth/http';
import { updateBackToStatsButton } from '../dashboard/back-to-stats';
import { leaveDashboardScreen } from '../dashboard/dashboard';
import { closeFeedbackForm } from '../feedback/feedback';
import { leaveRoomScreen } from '../rooms/room-screen';
import { resetRoomSessionClient, setReviewRoomMode } from '../rooms/room-session';
import { leaveRoomsScreen } from '../rooms/rooms-screen';
import { roomSessionState, roomSnapshotCache, roomsState } from '../rooms/state';
import { focusDom } from '../session/dom';
import { activeSessionState } from '../session/state';
import { renderFocusSession, renderReviewSession } from '../session/views';
import { loadingDom } from '../shared/dom';
import { addAfterSwitchHook, addBeforeSwitchHook, navigateTo } from '../shared/navigation';
import { toggleUserMenu, userMenuState } from '../shared/user-menu';
import { isHeaderScreenName } from '../types/screens';

/** Add every step that must run around a screen change, in the order the steps must run. */
export function registerNavigationHooks(): void {
    setLoginRequiredHandler(/** Send the user to Login when a request needs a new sign-in. */ (currentScreen) => {
        if (currentScreen !== undefined) navigateTo('login', currentScreen);
        loginDom.error.textContent = 'Please sign in again. Queued sessions remain on this browser.';
    });
    addBeforeSwitchHook(/** Close the feedback form on every screen change. */ () => {
        closeFeedbackForm();
    });
    addBeforeSwitchHook(/** Stop Dashboard loading when leaving the Dashboard. */ (nextScreen, currentScreen) => {
        if (currentScreen === 'dashboard' && nextScreen !== 'dashboard') leaveDashboardScreen();
    });
    addBeforeSwitchHook(/** Stop Rooms polling when leaving Rooms. */ (nextScreen, currentScreen) => {
        if (currentScreen === 'rooms' && nextScreen !== 'rooms') leaveRoomsScreen();
    });
    addBeforeSwitchHook(/** Stop Room polling when leaving a Room. */ (nextScreen, currentScreen) => {
        if (currentScreen === 'room' && nextScreen !== 'room') leaveRoomScreen();
    });
    addBeforeSwitchHook(/** Close the open account menu when leaving a header screen. */ (_nextScreen, currentScreen) => {
        if (isHeaderScreenName(currentScreen) && userMenuState.isOpened) {
            toggleUserMenu(currentScreen);
        }
    });
    addBeforeSwitchHook(/** Hide the Loading spinner when Loading hands over to Register. */ (nextScreen, currentScreen) => {
        if (currentScreen === 'loading' && nextScreen === 'register') {
            loadingDom.spinner.style.display = 'none';
        }
    });
    addBeforeSwitchHook(/** Forget room data when the user reaches Login, Register or Loading. */ (nextScreen) => {
        if (nextScreen === 'login' || nextScreen === 'register' || nextScreen === 'loading') {
            resetRoomSessionClient();
            roomsState.hasLoaded = false;
            roomsState.rooms = [];
            roomSnapshotCache.clear();
        }
    });
    addBeforeSwitchHook(/** Draw the Focus and Review screens before they show. */ (nextScreen, currentScreen) => {
        const displaySession = roomSessionState.active ? roomSessionState.display : activeSessionState;
        if (nextScreen === 'focus') {
            focusDom.roomName.hidden = !roomSessionState.active;
        }
        if (nextScreen === 'focus' && currentScreen !== 'review') {
            renderFocusSession(displaySession);
        }
        if (nextScreen === 'focus' && currentScreen === 'loading') {
            focusDom.pauseButton.textContent = 'Resume';
        }
        if (nextScreen === 'review') {
            renderReviewSession(displaySession);
            setReviewRoomMode(roomSessionState.active);
        }
    });
    addAfterSwitchHook(/** Refresh the back-to-stats button for the new screen. */ () => {
        updateBackToStatsButton();
    });
}
