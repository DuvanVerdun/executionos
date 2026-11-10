import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../auth/state';
import { roomStore } from '../rooms/state';
import { saveLastScreen } from '../shared/last-screen';
import { addBeforeSwitchHook, getCurrentScreenName, navigateTo, screenStore } from '../shared/navigation';
import { initializeStreakState } from '../streak/streak';
import { fakeBackendByPath, requestedPaths } from '../test/network';
import { registerNavigationHooks } from './hooks';
import { routeToInitialScreen } from './startup';

/** Answer "no room session is running" and fail every other request. */
function backendWithoutRoomSession() {
    return fakeBackendByPath(/** Pick the answer for one request. */ (path) => (path === 'room-session'
        ? { status: 200, body: { success: true, server_time: '2026-11-09T12:00:00Z', active: false, session: null, notice: null } }
        : { status: 500 }));
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    authStore.set({ accessToken: 'token', userId: 1, username: 'ana' });
    screenStore.set({ screen: 'loading' });
    sessionStorage.clear();
    initializeStreakState();
});

describe('opening the app after sign-in', () => {
    it('opens Plan when there is no last screen', async () => {
        backendWithoutRoomSession();
        await routeToInitialScreen();
        expect(getCurrentScreenName()).toBe('plan');
    });

    it('opens the Dashboard and loads it when the user was there', async () => {
        const fake = backendWithoutRoomSession();
        saveLastScreen(1, { screen: 'dashboard' });
        await routeToInitialScreen();
        expect(getCurrentScreenName()).toBe('dashboard');
        expect(requestedPaths(fake).some(/** Find the dashboard request. */ (path) => path.startsWith('dashboard'))).toBe(true);
    });

    it('opens Rooms and loads them when the user was there', async () => {
        const fake = backendWithoutRoomSession();
        saveLastScreen(1, { screen: 'rooms' });
        await routeToInitialScreen();
        expect(getCurrentScreenName()).toBe('rooms');
        expect(requestedPaths(fake).some(/** Find the rooms request. */ (path) => path.startsWith('rooms'))).toBe(true);
    });

    it('opens the room that the user was in', async () => {
        backendWithoutRoomSession();
        saveLastScreen(1, { screen: 'room', roomId: 7 });
        await routeToInitialScreen();
        expect(getCurrentScreenName()).toBe('room');
        expect(roomStore.get().roomId).toBe(7);
    });

    it('opens Plan when the last screen belongs to another account', async () => {
        backendWithoutRoomSession();
        saveLastScreen(2, { screen: 'dashboard' });
        await routeToInitialScreen();
        expect(getCurrentScreenName()).toBe('plan');
    });

    it('goes to Register when nobody is signed in', async () => {
        authStore.set({ accessToken: null, userId: null, username: '' });
        saveLastScreen(1, { screen: 'dashboard' });
        await routeToInitialScreen();
        expect(getCurrentScreenName()).toBe('register');
    });
});

describe('remembering the screen', () => {
    it('saves each header screen and room that the user opens', () => {
        registerNavigationHooks();
        const seen: string[] = [];
        addBeforeSwitchHook(/** Record the screen that is about to show. */ (next) => { seen.push(next); });
        screenStore.set({ screen: 'plan' });
        navigateTo('dashboard', 'plan');
        navigateTo('rooms', 'dashboard');
        roomStore.update({ roomId: 9 });
        navigateTo('room', 'rooms');
        expect(seen).toEqual(['dashboard', 'rooms', 'room']);
        expect(sessionStorage.getItem('executionOS_lastScreen')).toBe('{"userId":1,"screen":"room","roomId":9}');
    });

    it('does not save Focus or Review', () => {
        registerNavigationHooks();
        screenStore.set({ screen: 'plan' });
        navigateTo('dashboard', 'plan');
        screenStore.set({ screen: 'plan' });
        navigateTo('focus', 'plan');
        expect(sessionStorage.getItem('executionOS_lastScreen')).toBe('{"userId":1,"screen":"dashboard"}');
    });

    it('saves nothing when nobody is signed in', () => {
        registerNavigationHooks();
        authStore.set({ accessToken: null, userId: null, username: '' });
        screenStore.set({ screen: 'plan' });
        navigateTo('dashboard', 'plan');
        expect(sessionStorage.getItem('executionOS_lastScreen')).toBeNull();
    });
});
