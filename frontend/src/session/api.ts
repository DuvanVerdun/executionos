import { apiFetch } from '../auth/http';
import { authStore } from '../auth/state';
import { StatusError } from '../lib/errors';
import type { ApiResult } from '../types/api';
import type { ScreenName } from '../types/screens';
import type { SessionSubmission } from '../types/session';

/** Submit a session for its owner and require confirmed server acceptance. */
export async function postSession(sessionData: SessionSubmission, userId: number): Promise<ApiResult<{ message: string; session_id: number }>> {
    if (userId !== authStore.get().userId) throw new Error('Session account changed');
    const result = await apiFetch<ApiResult<{ message: string; session_id: number }>>({
        path: 'save-session', method: 'POST', body: sessionData,
        currentScreen: 'review', keepScreen: true, userId,
        signal: AbortSignal.timeout(20000)
    });
    if (result.status < 200 || result.status >= 300 || !result.success) {
        throw new StatusError((!result.success && result.error) || 'The server did not save this session', result.status);
    }
    return result;
}

/** Request a new mission for an owned session. The times of the session never change. */
export function patchSessionMission(sessionId: number, mission: string, currentScreen: ScreenName): Promise<ApiResult<{ mission: string }>> {
    return apiFetch<ApiResult<{ mission: string }>>({ path: `update-session/${sessionId}`, method: 'PATCH', body: { mission }, currentScreen });
}

/** Request deletion of an owned session. */
export function deleteSession(sessionId: string, currentScreen: ScreenName = 'dashboard'): Promise<ApiResult<{ message: string; session_id: number }>> {
    return apiFetch<ApiResult<{ message: string; session_id: number }>>({ path: `delete-session/${sessionId}`, method: 'DELETE', currentScreen });
}
