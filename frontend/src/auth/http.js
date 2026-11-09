// Requests to the backend, with access-token refresh and one retry.

import { BACKEND_URL } from '../config.js';
import { setAuthenticatedUser } from './identity.js';
import { authState } from './state.js';

let loginRequiredHandler = null;

/** Register what happens when a request shows the user must sign in again. The app shell provides it. */
export function setLoginRequiredHandler(handler) {
    loginRequiredHandler = handler;
}

/** Send a cookie-enabled unauthenticated JSON request and include its HTTP status. */
export async function unauthFetch(options) {
    if (!options.path || !options.method) {
        throw new Error('Missing required options: path and method');
    }
    const response = await fetch(`${BACKEND_URL}/api/${options.path}`, {
        method: options.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body),
        credentials: 'include'
    });
    const result = await response.json();
    result.status = response.status;
    return result;
}

/** Request fresh credentials using the refresh cookie. */
export async function refreshAccessToken() {
    const response = await fetch(`${BACKEND_URL}/api/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: AbortSignal.timeout(20000)
    });
    if (response.status === 401 || response.status === 403) return '';

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Token refresh failed');
    return result;
}

/** Send a JSON request with the supplied access token. */
function sendAuthenticatedRequest(options, token) {
    return fetch(`${BACKEND_URL}/api/${options.path}`, {
        method: options.method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(options.body),
        signal: options.signal
    });
}

/** Send an authenticated request and retry once after token refresh. */
export async function apiFetch(options) {
    if (!options.path || !options.method) {
        throw new Error('Missing required options: path and method');
    }
    const response = await sendAuthenticatedRequest(options, authState.accessToken);
    if (response.status === 401) {
        const result = await refreshAccessToken();
        if (!result || (options.userId != null && result.user_id !== options.userId)) {
            const error = new Error('Please sign in to the account that owns this session.');
            error.status = 401;
            if (!options.keepScreen) {
                loginRequiredHandler?.(options.currentScreen);
            }
            throw error;
        }
        const retry = await sendAuthenticatedRequest(options, result.access_token);
        if (retry.status === 401) {
            if (!options.keepScreen) {
                loginRequiredHandler?.(options.currentScreen);
            }
            const error = new Error('Unauthorized: Please log in.');
            error.status = 401;
            throw error;
        }
        const retryResult = await retry.json();
        retryResult.status = retry.status;
        setAuthenticatedUser(result);
        return retryResult;
    }
    const result = await response.json();
    result.status = response.status;
    return result;
}
