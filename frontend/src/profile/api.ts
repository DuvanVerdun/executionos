import { apiFetch } from '../auth/http';
import type { ApiResult } from '../types/api';
import type { PresenceReport } from '../types/social';

/** Tell the server the state of the running session. A failed report never signs the user out. */
export function putPresence(report: PresenceReport): Promise<ApiResult<object>> {
    return apiFetch<ApiResult<object>>({
        path: 'presence', method: 'PUT', body: report, keepScreen: true,
        signal: AbortSignal.timeout(20000)
    });
}

/** Tell the server that the session ended. */
export function deletePresence(): Promise<ApiResult<object>> {
    return apiFetch<ApiResult<object>>({
        path: 'presence', method: 'DELETE', keepScreen: true,
        signal: AbortSignal.timeout(20000)
    });
}
