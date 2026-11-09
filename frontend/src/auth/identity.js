// Remember or forget the signed-in user.

import { dashboardDom } from '../dashboard/dom.js';
import { roomsDom } from '../rooms/dom.js';
import { planDom } from '../session/dom.js';
import { sessionRuntime } from '../session/state.js';
import { setFloatingMessage } from '../shared/floating-message.js';
import { authState } from './state.js';

/** Store authenticated identity and update the displayed username. */
export function setAuthenticatedUser(result) {
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
export function clearAuthenticatedUser() {
    authState.accessToken = null;
    authState.userId = null;
    setFloatingMessage('');
    planDom.username.textContent = '';
    dashboardDom.username.textContent = '';
    roomsDom.username.textContent = '';
}
