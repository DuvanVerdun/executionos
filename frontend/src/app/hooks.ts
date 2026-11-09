import { authFormStore } from '../auth/forms-state';
import { setLoginRequiredHandler } from '../auth/http';
import { leaveDashboardScreen } from '../dashboard/dashboard';
import { closeFeedbackForm } from '../feedback/feedback';
import { leaveRoomScreen } from '../rooms/room';
import { resetRoomSessionClient, setReviewRoomMode } from '../rooms/room-session';
import { roomSessionStore } from '../rooms/room-session-state';
import { leaveRoomsScreen, resetRoomsData } from '../rooms/rooms';
import { roomSnapshotCache } from '../rooms/state';
import { focusStore } from '../session/ui-state';
import { addBeforeSwitchHook, navigateTo } from '../shared/navigation';
import { closeUserMenu, userMenuStore } from '../shared/user-menu';
import { isHeaderScreenName } from '../types/screens';

/** Add every step that must run around a screen change, in the order the steps must run. */
export function registerNavigationHooks(): void {
    setLoginRequiredHandler(/** Send the user to Login when a request needs a new sign-in. */ (currentScreen) => {
        if (currentScreen !== undefined) navigateTo('login', currentScreen);
        authFormStore.update({ loginError: 'Please sign in again. Queued sessions remain on this browser.' });
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
        if (isHeaderScreenName(currentScreen) && userMenuStore.get().openScreen !== null) {
            closeUserMenu();
        }
    });
    addBeforeSwitchHook(/** Forget room data when the user reaches Login, Register or Loading. */ (nextScreen) => {
        if (nextScreen === 'login' || nextScreen === 'register' || nextScreen === 'loading') {
            resetRoomSessionClient();
            resetRoomsData();
            roomSnapshotCache.clear();
        }
    });
    addBeforeSwitchHook(/** Prepare the Focus and Review screens before they show. */ (nextScreen, currentScreen) => {
        if (nextScreen === 'focus' && currentScreen === 'loading') {
            focusStore.set({ pauseLabel: 'Resume' });
        }
        if (nextScreen === 'review') {
            setReviewRoomMode(roomSessionStore.get().active);
        }
    });
}
