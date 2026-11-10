import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorStatus } from '../lib/errors';
import { fakeBackend } from '../test/network';
import { apiFetch, refreshAccessToken, setLoginRequiredHandler, unauthFetch } from './http';
import { authStore } from './state';

const credentials = { success: true, message: 'ok', user_id: 1, access_token: 'new-token', username: 'ana' };

/** Read the Authorization header of a request the fake backend received. */
function authorizationOf(fake: ReturnType<typeof fakeBackend>, call: number): string | undefined {
    const headers = fake.mock.calls[call]?.[1]?.headers;
    return headers instanceof Headers ? undefined : (headers as Record<string, string> | undefined)?.Authorization;
}

beforeEach(() => {
    authStore.set({ accessToken: 'old-token', userId: 1, username: 'ana' });
});

describe('apiFetch', () => {
    it('sends the access token and adds the HTTP status to the answer', async () => {
        const fake = fakeBackend({ status: 200, body: { success: true, value: 7 } });
        const result = await apiFetch<{ success: true; value: number; status: number }>({ path: 'thing', method: 'GET' });
        expect(result).toEqual({ success: true, value: 7, status: 200 });
        expect(authorizationOf(fake, 0)).toBe('Bearer old-token');
    });

    it('keeps a failure answer and its status', async () => {
        fakeBackend({ status: 400, body: { success: false, error: 'Bad data' } });
        const result = await apiFetch<{ success: boolean; error?: string; status: number }>({ path: 'thing', method: 'POST' });
        expect(result).toEqual({ success: false, error: 'Bad data', status: 400 });
    });

    it('refreshes the token after a 401 and tries again once', async () => {
        const fake = fakeBackend({ status: 401 }, { status: 200, body: credentials }, { status: 200, body: { success: true } });
        const result = await apiFetch<{ success: boolean; status: number }>({ path: 'thing', method: 'GET' });
        expect(result.status).toBe(200);
        expect(fake).toHaveBeenCalledTimes(3);
        expect(authorizationOf(fake, 2)).toBe('Bearer new-token');
        expect(authStore.get().accessToken).toBe('new-token');
    });

    it('sends the user to Login when the refresh session is gone', async () => {
        const handler = vi.fn();
        setLoginRequiredHandler(handler);
        fakeBackend({ status: 401 }, { status: 401 });
        const failure = apiFetch({ path: 'thing', method: 'GET', currentScreen: 'dashboard' });
        await expect(failure).rejects.toMatchObject({ status: 401 });
        expect(handler).toHaveBeenCalledWith('dashboard');
    });

    it('sends the user to Login when the second try is also refused', async () => {
        const handler = vi.fn();
        setLoginRequiredHandler(handler);
        fakeBackend({ status: 401 }, { status: 200, body: credentials }, { status: 401 });
        await expect(apiFetch({ path: 'thing', method: 'GET', currentScreen: 'plan' })).rejects.toMatchObject({ status: 401 });
        expect(handler).toHaveBeenCalledWith('plan');
    });

    it('does not leave the screen when asked to keep it', async () => {
        const handler = vi.fn();
        setLoginRequiredHandler(handler);
        fakeBackend({ status: 401 }, { status: 401 });
        await expect(apiFetch({ path: 'save-session', method: 'POST', keepScreen: true })).rejects.toThrow();
        expect(handler).not.toHaveBeenCalled();
    });

    it('refuses a refresh that signs in another account', async () => {
        const handler = vi.fn();
        setLoginRequiredHandler(handler);
        fakeBackend({ status: 401 }, { status: 200, body: { ...credentials, user_id: 2 } });
        const failure = apiFetch({ path: 'save-session', method: 'POST', userId: 1, currentScreen: 'review' });
        await expect(failure).rejects.toThrow('Please sign in to the account that owns this session.');
        expect(handler).toHaveBeenCalledWith('review');
    });

    it('throws a StatusError that carries the 401', async () => {
        setLoginRequiredHandler(vi.fn());
        fakeBackend({ status: 401 }, { status: 401 });
        const failure = await apiFetch({ path: 'thing', method: 'GET' }).catch(/** Return the error. */ (error: unknown) => error);
        expect(errorStatus(failure)).toBe(401);
    });
});

describe('refreshAccessToken', () => {
    it.each([401, 403])('returns null for a %i', async (status) => {
        fakeBackend({ status });
        expect(await refreshAccessToken()).toBeNull();
    });

    it('returns the new credentials', async () => {
        fakeBackend({ status: 200, body: credentials });
        expect(await refreshAccessToken()).toMatchObject({ access_token: 'new-token', user_id: 1 });
    });

    it('throws when the server answers without success', async () => {
        fakeBackend({ status: 200, body: { success: false, error: 'User not found' } });
        await expect(refreshAccessToken()).rejects.toThrow('User not found');
    });
});

describe('unauthFetch', () => {
    it('sends the cookie and adds the status, without a token', async () => {
        const fake = fakeBackend({ status: 409, body: { success: false, error: 'taken' } });
        const result = await unauthFetch<{ status: number }>({ path: 'register', method: 'POST', body: { a: 1 } });
        expect(result.status).toBe(409);
        expect(fake.mock.calls[0]?.[1]?.credentials).toBe('include');
        expect(authorizationOf(fake, 0)).toBeUndefined();
    });
});
