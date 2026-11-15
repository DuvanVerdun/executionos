import { apiFetch } from '../auth/http';
import { SOCIAL_REQUEST_TIMEOUT_MS } from '../config';
import { getBrowserTimezone } from '../lib/dates';
import type { ApiResult, HttpMethod } from '../types/api';
import type { FollowingList, PresenceReport, Profile, SearchUser } from '../types/social';

/** What a follow request leaves between two users: accepted at once, or waiting for a private account. */
export type FollowStatus = 'accepted' | 'pending';

/** Send a request of the Profile screen, with a timeout. A lost sign-in sends the user to Login from that screen. */
function socialFetch<R extends { status: number }>(path: string, method: HttpMethod): Promise<R> {
    return apiFetch<R>({ path, method, currentScreen: 'profile', signal: AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS) });
}

/** Request a profile. The server answers 404 for a user who does not exist, who blocked the user, or who the user blocked. */
export function fetchProfile(username: string): Promise<ApiResult<{ profile: Profile }>> {
    const params = new URLSearchParams({ timezone: getBrowserTimezone() });
    return socialFetch<ApiResult<{ profile: Profile }>>(`users/${encodeURIComponent(username)}?${params.toString()}`, 'GET');
}

/** Request the follow requests waiting for the user, and the people they follow. */
export function fetchFollowing(): Promise<ApiResult<FollowingList>> {
    const params = new URLSearchParams({ timezone: getBrowserTimezone() });
    return socialFetch<ApiResult<FollowingList>>(`following?${params.toString()}`, 'GET');
}

/** Request the users whose username starts with the text. */
export function fetchUserSearch(query: string): Promise<ApiResult<{ users: SearchUser[] }>> {
    return socialFetch<ApiResult<{ users: SearchUser[] }>>(`user-search?q=${encodeURIComponent(query)}`, 'GET');
}

/** Request to follow a user, or to ask a private account to be followed. */
export function putFollow(username: string): Promise<ApiResult<{ follow_status: FollowStatus }>> {
    return socialFetch<ApiResult<{ follow_status: FollowStatus }>>(`users/${encodeURIComponent(username)}/follow`, 'PUT');
}

/** Request to stop following a user, or to take back a request. */
export function deleteFollow(username: string): Promise<ApiResult<object>> {
    return socialFetch<ApiResult<object>>(`users/${encodeURIComponent(username)}/follow`, 'DELETE');
}

/** Request to accept the request that a user sent. */
export function postAcceptFollowRequest(username: string): Promise<ApiResult<object>> {
    return socialFetch<ApiResult<object>>(`follow-requests/${encodeURIComponent(username)}/accept`, 'POST');
}

/** Request to decline the request that a user sent. */
export function deleteFollowRequest(username: string): Promise<ApiResult<object>> {
    return socialFetch<ApiResult<object>>(`follow-requests/${encodeURIComponent(username)}`, 'DELETE');
}

/** Request to block a user. */
export function putBlock(username: string): Promise<ApiResult<object>> {
    return socialFetch<ApiResult<object>>(`blocks/${encodeURIComponent(username)}`, 'PUT');
}

/** Tell the server the state of the running session. A failed report never signs the user out. */
export function putPresence(report: PresenceReport): Promise<ApiResult<object>> {
    return apiFetch<ApiResult<object>>({
        path: 'presence', method: 'PUT', body: report, keepScreen: true,
        signal: AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS)
    });
}

/** Tell the server that the session ended. */
export function deletePresence(): Promise<ApiResult<object>> {
    return apiFetch<ApiResult<object>>({
        path: 'presence', method: 'DELETE', keepScreen: true,
        signal: AbortSignal.timeout(SOCIAL_REQUEST_TIMEOUT_MS)
    });
}
