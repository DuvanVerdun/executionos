import { sessionStore } from '../session/state';
import { setFloatingMessage } from '../shared/floating-message';
import type { Credentials } from '../types/api';
import { authStore } from './state';

/** Store authenticated identity and the displayed username. */
export function setAuthenticatedUser(result: Credentials): void {
    if (authStore.get().userId !== result.user_id) {
        sessionStore.update({ pendingSubmission: null });
        setFloatingMessage('');
    }
    authStore.set({ accessToken: result.access_token, userId: result.user_id, username: result.username });
}

/** Clear in-memory identity and displayed account feedback. */
export function clearAuthenticatedUser(): void {
    authStore.set({ accessToken: null, userId: null, username: '' });
    setFloatingMessage('');
}
