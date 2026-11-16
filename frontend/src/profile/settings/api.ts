import { apiFetch } from '../../auth/http';
import { SOCIAL_REQUEST_TIMEOUT_MS } from '../../config';
import type { ApiFailure, ApiResult, Credentials, HttpMethod } from '../../types/api';
import type { Account, BlockedUser } from '../../types/social';

/** The answer to a change of the username. A refusal because of the 30 days also says when the username can change. */
export type UsernameResult = ApiResult<{ account: Account }> | (ApiFailure & { next_change_at?: string });

/** Send a request of the settings, with a timeout. A lost sign-in sends the user to Login from the Profile. */
function settingsFetch<R extends { status: number }>(path: string, method: HttpMethod, body?: unknown): Promise<R> {
    return apiFetch<R>({ path, method, body, currentScreen: 'profile', signal: AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS) });
}

/** Request the settings of the account. */
export function fetchAccount(): Promise<ApiResult<{ account: Account }>> {
    return settingsFetch<ApiResult<{ account: Account }>>('account', 'GET');
}

/** Request a new username. */
export function patchUsername(username: string): Promise<UsernameResult> {
    return settingsFetch<UsernameResult>('account/username', 'PATCH', { username });
}

/** Request to make the account private or public. */
export function patchPrivacy(isPrivate: boolean): Promise<ApiResult<{ is_private: boolean }>> {
    return settingsFetch<ApiResult<{ is_private: boolean }>>('account/privacy', 'PATCH', { isPrivate });
}

/** Request a new password. The server answers with fresh credentials, because it ends the other sessions. */
export function patchPassword(currentPassword: string, newPassword: string): Promise<ApiResult<Credentials>> {
    return settingsFetch<ApiResult<Credentials>>('account/password', 'PATCH', { currentPassword, newPassword });
}

/** Request the users that the user blocked. */
export function fetchBlocks(): Promise<ApiResult<{ blocked: BlockedUser[] }>> {
    return settingsFetch<ApiResult<{ blocked: BlockedUser[] }>>('blocks', 'GET');
}

/** Request to unblock a user. */
export function deleteBlock(username: string): Promise<ApiResult<object>> {
    return settingsFetch<ApiResult<object>>(`blocks/${encodeURIComponent(username)}`, 'DELETE');
}
