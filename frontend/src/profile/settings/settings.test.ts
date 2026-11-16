import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../../auth/state';
import { setLanguage } from '../../i18n/i18n';
import { answerConfirm, confirmStore } from '../../shared/confirm';
import { floatingMessageStore } from '../../shared/floating-message';
import { fakeBackendByPath, jsonBodyOf, pathOf, type FakeAnswer } from '../../test/network';
import type { Account } from '../../types/social';
import { searchStore, profileStore } from '../state';
import {
    changePassword, changePrivacy, changeUsername, closeSettings, formatUsernameChangeDay, isUsernameLocked,
    loadAccount, loadBlocked, openSettings, selectSection, unblockUser
} from './settings';
import { settingsStore } from './state';

const ACCOUNT: Account = { username: 'duvan', is_private: false, username_next_change_at: null };
const CREDENTIALS = { success: true, message: 'Password changed', user_id: 1, access_token: 'new-token', username: 'duvan' };

/** The answers of a fake backend by "METHOD path". A request without an answer fails with 500. */
function backend(routes: Record<string, FakeAnswer>) {
    return fakeBackendByPath((path, init) => routes[`${init?.method ?? 'GET'} ${path.split('?')[0] ?? ''}`] ?? { status: 500 });
}

/** List the requests that a fake backend got as "METHOD path". */
function requests(fake: ReturnType<typeof backend>): string[] {
    return fake.mock.calls.map(/** Describe one request. */ ([url, init]) => `${init?.method ?? 'GET'} ${pathOf(url).split('?')[0] ?? ''}`);
}

beforeEach(() => {
    authStore.update({ accessToken: 'token', userId: 1, username: 'duvan' });
    settingsStore.update({ account: ACCOUNT, accountLoad: 'ready' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('opening and closing the settings', () => {
    it('shows the settings, clears the search, starts at the username, and loads the account', async () => {
        const fake = backend({ 'GET account': { status: 200, body: { success: true, account: ACCOUNT } } });
        searchStore.update({ query: 'lu', status: 'ready' });
        settingsStore.update({ section: 'privacy', accountLoad: 'error' });
        openSettings();
        expect(profileStore.get().panel).toBe('settings');
        expect(settingsStore.get()).toMatchObject({ section: 'username', accountLoad: 'loading' });
        expect(searchStore.get().query).toBe('');
        await vi.waitFor(() => { expect(settingsStore.get().accountLoad).toBe('ready'); });
        expect(requests(fake)).toEqual(['GET account']);
    });

    it('shows the profile again', () => {
        profileStore.update({ panel: 'settings' });
        closeSettings();
        expect(profileStore.get().panel).toBe('profile');
    });

    it('loads the blocked users only when their option opens', async () => {
        const fake = backend({ 'GET blocks': { status: 200, body: { success: true, blocked: [{ username: 'ana' }] } } });
        selectSection('password');
        expect(fake).not.toHaveBeenCalled();
        selectSection('blocked');
        await vi.waitFor(() => { expect(settingsStore.get().blockedLoad).toBe('ready'); });
        expect(settingsStore.get()).toMatchObject({ section: 'blocked', blocked: [{ username: 'ana' }] });
    });

    it('shows an error when the account or the blocked users do not load', async () => {
        backend({});
        await loadAccount();
        await loadBlocked();
        expect(settingsStore.get()).toMatchObject({ accountLoad: 'error', blockedLoad: 'error' });
    });
});

describe('the wait before the username can change again', () => {
    it('is a wait only while the day has not come', () => {
        const day = '2026-12-15T12:00:00.000';
        const before = Date.parse('2026-12-01T00:00:00Z');
        expect(isUsernameLocked({ ...ACCOUNT, username_next_change_at: day }, before)).toBe(true);
        expect(isUsernameLocked({ ...ACCOUNT, username_next_change_at: day }, Date.parse('2026-12-16T00:00:00Z'))).toBe(false);
        expect(isUsernameLocked(ACCOUNT, before)).toBe(false);
    });

    it('is written as a short date in the language of the app', () => {
        expect(formatUsernameChangeDay('2026-12-15T12:00:00.000')).toBe('Tue, Dec 15');
        setLanguage('es');
        expect(formatUsernameChangeDay('2026-12-15T12:00:00.000')).toBe('mar, 15 dic');
    });
});

describe('changing the username', () => {
    it.each([
        ['', 'Enter a username.'],
        ['   ', 'Enter a username.'],
        ['x'.repeat(51), 'Use 50 characters or fewer.']
    ])('refuses %j without asking the server', async (username, message) => {
        const fake = backend({});
        expect(await changeUsername(username)).toEqual({ kind: 'error', message });
        expect(fake).not.toHaveBeenCalled();
    });

    it('saves it, updates the account and the name that the app shows, and refreshes the profile', async () => {
        const account: Account = { username: 'new.name', is_private: false, username_next_change_at: '2026-12-15T12:00:00.000' };
        const fake = backend({ 'PATCH account/username': { status: 200, body: { success: true, account } }, 'GET users/new.name': { status: 500 } });
        expect(await changeUsername('  New.Name ')).toEqual({ kind: 'saved' });
        expect(jsonBodyOf(fake.mock.calls[0]?.[1])).toEqual({ username: 'New.Name' });
        expect(settingsStore.get().account).toEqual(account);
        expect(authStore.get().username).toBe('new.name');
        await vi.waitFor(() => { expect(requests(fake)).toContain('GET users/new.name'); });
    });

    it('says when the username is taken', async () => {
        backend({ 'PATCH account/username': { status: 409, body: { success: false, error: 'Username already in use' } } });
        expect(await changeUsername('lucia')).toEqual({ kind: 'error', message: 'That username is already in use.' });
        expect(settingsStore.get().account).toEqual(ACCOUNT);
    });

    it('says when it can change again, and remembers the day', async () => {
        backend({ 'PATCH account/username': { status: 409, body: { success: false, error: 'wait', next_change_at: '2026-12-15T12:00:00.000' } } });
        expect(await changeUsername('lucia')).toEqual({ kind: 'error', message: 'You changed it recently. You can change it again on Tue, Dec 15.' });
        expect(settingsStore.get().account?.username_next_change_at).toBe('2026-12-15T12:00:00.000');
    });

    it('says it did not work when the server fails', async () => {
        backend({});
        expect(await changeUsername('lucia')).toEqual({ kind: 'error', message: "That didn't work. Try again." });
    });
});

describe('changing the password', () => {
    it.each([
        ['', 'Brand-new-pass-1', 'Brand-new-pass-1', 'current', 'Enter your current password.'],
        ['old', 'short', 'short', 'new', 'At least 12 characters.'],
        ['old', 'lowercase-only-pass', 'lowercase-only-pass', 'new', 'Add uppercase, lowercase, a number and a symbol.'],
        ['old', 'Brand-new-pass-1', 'Brand-new-pass-2', 'confirm', "The passwords don't match."]
    ] as const)('refuses %j, %j, %j in the %s field without asking the server', async (current, next, confirmation, field, message) => {
        const fake = backend({});
        expect(await changePassword(current, next, confirmation)).toEqual({ kind: 'error', field, message });
        expect(fake).not.toHaveBeenCalled();
    });

    it('saves it and goes on with the fresh credentials', async () => {
        const fake = backend({ 'PATCH account/password': { status: 200, body: CREDENTIALS } });
        expect(await changePassword('old-password-1', 'Brand-new-pass-1', 'Brand-new-pass-1')).toEqual({ kind: 'saved' });
        expect(jsonBodyOf(fake.mock.calls[0]?.[1])).toEqual({ currentPassword: 'old-password-1', newPassword: 'Brand-new-pass-1' });
        expect(authStore.get()).toMatchObject({ accessToken: 'new-token', userId: 1, username: 'duvan' });
    });

    it('says when the current password is not the right one', async () => {
        backend({ 'PATCH account/password': { status: 403, body: { success: false, error: 'Current password is incorrect' } } });
        expect(await changePassword('wrong', 'Brand-new-pass-1', 'Brand-new-pass-1')).toEqual({ kind: 'error', field: 'current', message: 'The current password is not correct.' });
        expect(authStore.get().accessToken).toBe('token');
    });

    it('says it did not work when the server fails', async () => {
        backend({});
        expect(await changePassword('old', 'Brand-new-pass-1', 'Brand-new-pass-1')).toEqual({ kind: 'error', field: 'form', message: "That didn't work. Try again." });
    });
});

describe('changing the privacy', () => {
    it('saves the choice, and refreshes the profile', async () => {
        const fake = backend({ 'PATCH account/privacy': { status: 200, body: { success: true, is_private: true } }, 'GET users/duvan': { status: 500 } });
        expect(await changePrivacy(true)).toEqual({ kind: 'saved' });
        expect(jsonBodyOf(fake.mock.calls[0]?.[1])).toEqual({ isPrivate: true });
        expect(settingsStore.get().account?.is_private).toBe(true);
        await vi.waitFor(() => { expect(requests(fake)).toContain('GET users/duvan'); });
    });

    it('keeps the account as it was when the server fails', async () => {
        backend({});
        expect(await changePrivacy(true)).toEqual({ kind: 'error', message: "That didn't work. Try again." });
        expect(settingsStore.get().account?.is_private).toBe(false);
    });
});

describe('unblocking', () => {
    beforeEach(() => {
        settingsStore.update({ blocked: [{ username: 'ana' }, { username: 'jose' }], blockedLoad: 'ready' });
    });

    /** Start the unblock, and answer the question that it asks. */
    async function unblockAnswering(confirmed: boolean): Promise<void> {
        const done = unblockUser('ana');
        await vi.waitFor(() => { expect(confirmStore.get().request).not.toBeNull(); });
        expect(confirmStore.get().request?.message).toBe('Unblock ana?');
        answerConfirm(confirmed);
        await done;
    }

    it('asks first, unblocks, and takes the user off the list', async () => {
        const fake = backend({ 'DELETE blocks/ana': { status: 200, body: { success: true } } });
        await unblockAnswering(true);
        expect(requests(fake)).toEqual(['DELETE blocks/ana']);
        expect(settingsStore.get().blocked).toEqual([{ username: 'jose' }]);
    });

    it('does nothing when the user cancels', async () => {
        const fake = backend({});
        await unblockAnswering(false);
        expect(fake).not.toHaveBeenCalled();
        expect(settingsStore.get().blocked).toHaveLength(2);
    });

    it('keeps the list and tells the user when it fails', async () => {
        backend({});
        await unblockAnswering(true);
        expect(settingsStore.get().blocked).toHaveLength(2);
        expect(floatingMessageStore.get()).toMatchObject({ message: "That didn't work. Try again.", error: true });
    });
});
