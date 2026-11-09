// Remember or forget the signed-in user.

import { dashboardDom } from '../dashboard/dom';
import { roomsDom } from '../rooms/dom';
import { planDom } from '../session/dom';
import { sessionRuntime } from '../session/state';
import { setFloatingMessage } from '../shared/floating-message';
import type { Credentials } from '../types/api';
import { authState } from './state';

/** Store authenticated identity and update the displayed username. */
export function setAuthenticatedUser(result: Credentials): void {
    if (authState.userId !== (result.user_id ?? null)) {
        sessionRuntime.pendingSubmission = null;
        setFloatingMessage('');
    }
    authState.accessToken = result.access_token;
    authState.userId = result.user_id ?? null;
    planDom.username.textContent = result.username;
    dashboardDom.username.textContent = result.username;
    roomsDom.username.textContent = result.username;
}

/** Clear in-memory identity and displayed account feedback. */
export function clearAuthenticatedUser(): void {
    authState.accessToken = null;
    authState.userId = null;
    setFloatingMessage('');
    planDom.username.textContent = '';
    dashboardDom.username.textContent = '';
    roomsDom.username.textContent = '';
}
