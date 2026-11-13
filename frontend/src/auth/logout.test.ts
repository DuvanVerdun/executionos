import { beforeEach, describe, expect, it, vi } from 'vitest';
import { answerConfirm, confirmStore } from '../shared/confirm';
import { floatingMessageStore } from '../shared/floating-message';
import { saveLastScreen, loadLastScreen } from '../shared/last-screen';
import { getCurrentScreenName, screenStore } from '../shared/navigation';
import { fakeBackend } from '../test/network';
import { handleLogout } from './logout';
import { authStore } from './state';

beforeEach(() => {
    authStore.set({ accessToken: 'token', userId: 1, username: 'ana' });
    screenStore.set({ screen: 'plan' });
});

describe('logging out', () => {
    it('asks first, and does nothing when the user cancels', async () => {
        const fake = fakeBackend({ status: 200, body: { success: true } });
        const logout = handleLogout('plan');
        expect(confirmStore.get().request?.message).toBe('Are you sure you want to log out?');
        answerConfirm(false);
        await logout;
        expect(fake).not.toHaveBeenCalled();
        expect(authStore.get().userId).toBe(1);
        expect(getCurrentScreenName()).toBe('plan');
    });

    it('signs out, forgets the last screen and shows the Landing when the user confirms', async () => {
        fakeBackend({ status: 200, body: { success: true } });
        saveLastScreen(1, { screen: 'dashboard' });
        const logout = handleLogout('plan');
        answerConfirm(true);
        await logout;
        expect(authStore.get().userId).toBeNull();
        expect(loadLastScreen(1)).toBeNull();
        expect(getCurrentScreenName()).toBe('landing');
    });

    it('shows an error message, and stays signed in, when the server cannot be reached', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        fakeBackend(new Error('offline'));
        const logout = handleLogout('plan');
        answerConfirm(true);
        await logout;
        expect(floatingMessageStore.get()).toMatchObject({ message: 'An unexpected network/server connection error occurred', error: true });
        expect(authStore.get().userId).toBe(1);
    });
});
