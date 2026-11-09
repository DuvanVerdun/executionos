// Calls to the backend session routes.

import { apiFetch } from '../auth/http.js';
import { authState } from '../auth/state.js';

/** Submit a session for its owner and require confirmed server acceptance. */
export async function postSession(sessionData, userId) {
    if (userId !== authState.userId) throw new Error('Session account changed');
    const result = await apiFetch({
        path: 'save-session', method: 'POST', body: sessionData,
        currentScreen: 'review', keepScreen: true, userId,
        signal: AbortSignal.timeout(20000)
    });
    if (result.status < 200 || result.status >= 300 || result.success !== true) {
        const error = new Error(result.error || 'The server did not save this session');
        error.status = result.status;
        throw error;
    }
    return result;
}

/** Request deletion of an owned session. */
export function deleteSession(sessionId, currentScreen = 'dashboard') {
    return apiFetch({ path: `delete-session/${sessionId}`, method: 'DELETE', currentScreen });
}
