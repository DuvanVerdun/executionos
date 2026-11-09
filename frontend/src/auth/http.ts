// Requests to the backend, with access-token refresh and one retry.

import { BACKEND_URL } from '../config';
import { StatusError } from '../lib/errors';
import type { Credentials, RequestOptions } from '../types/api';
import type { ScreenName } from '../types/screens';
import { setAuthenticatedUser } from './identity';
import { authState } from './state';

/** What to do when a request shows the user must sign in again. */
type LoginRequiredHandler = (currentScreen: ScreenName | undefined) => void;

/** The JSON a route sends: its own fields when it worked, an error when it did not. */
type ApiBody<T> = (T & { success: true }) | { success: false; error?: string };

let loginRequiredHandler: LoginRequiredHandler | null = null;

/** Register what happens when a request shows the user must sign in again. The app shell provides it. */
export function setLoginRequiredHandler(handler: LoginRequiredHandler): void {
    loginRequiredHandler = handler;
}

/**
 * Read a response body and add the HTTP status to it.
 * This is the one place the app trusts the backend's JSON: the cast says "the route sent what its type says".
 */
async function readResult<R extends { status: number }>(response: Response): Promise<R> {
    const body = (await response.json()) as Omit<R, 'status'>;
    return { ...body, status: response.status } as R;
}

/** Send a cookie-enabled unauthenticated JSON request and include its HTTP status. */
export async function unauthFetch<R extends { status: number }>(options: RequestOptions): Promise<R> {
    if (!options.path || !options.method) {
        throw new Error('Missing required options: path and method');
    }
    const response = await fetch(`${BACKEND_URL}/api/${options.path}`, {
        method: options.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body),
        credentials: 'include'
    });
    return readResult<R>(response);
}

/** Request fresh credentials using the refresh cookie. Return null when there is no valid refresh session. */
export async function refreshAccessToken(): Promise<Credentials | null> {
    const response = await fetch(`${BACKEND_URL}/api/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: AbortSignal.timeout(20000)
    });
    if (response.status === 401 || response.status === 403) return null;

    const result = (await response.json()) as ApiBody<Credentials>;
    if (!result.success) throw new Error(result.error || 'Token refresh failed');
    return result;
}

/** Send a JSON request with the supplied access token. */
function sendAuthenticatedRequest(options: RequestOptions, token: string | null): Promise<Response> {
    return fetch(`${BACKEND_URL}/api/${options.path}`, {
        method: options.method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(options.body),
        signal: options.signal ?? null
    });
}

/** Send an authenticated request and retry once after token refresh. */
export async function apiFetch<R extends { status: number }>(options: RequestOptions): Promise<R> {
    if (!options.path || !options.method) {
        throw new Error('Missing required options: path and method');
    }
    const response = await sendAuthenticatedRequest(options, authState.accessToken);
    if (response.status === 401) {
        const result = await refreshAccessToken();
        if (!result || (options.userId != null && result.user_id !== options.userId)) {
            if (!options.keepScreen) {
                loginRequiredHandler?.(options.currentScreen);
            }
            throw new StatusError('Please sign in to the account that owns this session.', 401);
        }
        const retry = await sendAuthenticatedRequest(options, result.access_token);
        if (retry.status === 401) {
            if (!options.keepScreen) {
                loginRequiredHandler?.(options.currentScreen);
            }
            throw new StatusError('Unauthorized: Please log in.', 401);
        }
        const retryResult = await readResult<R>(retry);
        setAuthenticatedUser(result);
        return retryResult;
    }
    return readResult<R>(response);
}
