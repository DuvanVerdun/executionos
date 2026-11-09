// Calls to the backend auth routes.

import { apiFetch, unauthFetch } from './http.js';

/** Submit account registration details. */
export function register(username, email, password) {
    return unauthFetch({ path: 'register', method: 'POST', body: { username, email, password } });
}

/** Submit username or email and password credentials. */
export function login(usernameOrEmail, password) {
    return unauthFetch({ path: 'login', method: 'POST', body: { usernameOrEmail, password } });
}

/** Request refresh-session invalidation on the server. */
export function logout() {
    return apiFetch({ path: 'logout', method: 'POST' });
}
