// What the backend sends back. Every response is JSON with a `success` flag.
// The HTTP status is added by the frontend, so callers can branch on it.

import type { ScreenName } from './screens';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** What a caller gives apiFetch / unauthFetch. */
export interface RequestOptions {
    path: string;
    method: HttpMethod;
    body?: unknown;
    /** The screen to leave if the sign-in is lost. */
    currentScreen?: ScreenName | undefined;
    /** Stay on the current screen when the sign-in is lost. */
    keepScreen?: boolean | undefined;
    /** The account that must own the request. A refresh for another account fails. */
    userId?: number | null | undefined;
    signal?: AbortSignal | undefined;
}

/** A response that says it failed. */
export interface ApiFailure {
    success: false;
    error?: string;
    status: number;
}

/** A response that says it worked: the route's own fields plus the status. */
export type ApiSuccess<T> = T & { success: true; status: number };

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** The fields of a sign-in, a registration and a token refresh. */
export interface Credentials {
    message: string;
    user_id: number;
    access_token: string;
    username: string;
}
