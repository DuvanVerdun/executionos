import type { ApiResult, Credentials } from '../types/api';
import { apiFetch, unauthFetch } from './http';

/** Submit account registration details. */
export function register(username: string, email: string, password: string): Promise<ApiResult<Credentials>> {
    return unauthFetch<ApiResult<Credentials>>({ path: 'register', method: 'POST', body: { username, email, password } });
}

/** Submit username or email and password credentials. */
export function login(usernameOrEmail: string, password: string): Promise<ApiResult<Credentials>> {
    return unauthFetch<ApiResult<Credentials>>({ path: 'login', method: 'POST', body: { usernameOrEmail, password } });
}

/** Request refresh-session invalidation on the server. */
export function logout(): Promise<ApiResult<{ message: string }>> {
    return apiFetch<ApiResult<{ message: string }>>({ path: 'logout', method: 'POST' });
}
