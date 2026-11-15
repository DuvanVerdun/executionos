import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../../auth/state';
import { feedbackStore } from '../../feedback/feedback';
import { languageStore } from '../../i18n/i18n';
import { confirmStore } from '../../shared/confirm';
import { screenStore } from '../../shared/navigation';
import { fakeBackendByPath, jsonBodyOf, type FakeAnswer } from '../../test/network';
import type { Account } from '../../types/social';
import { profile } from '../fixtures';
import { ProfileScreen } from '../ProfileScreen';
import { followingStore, profileStore } from '../state';
import { settingsStore } from './state';

const ACCOUNT: Account = { username: 'duvan', is_private: false, username_next_change_at: null };

/** The answers of a fake backend by "METHOD path". A request without an answer fails with 500. */
function backend(routes: Record<string, FakeAnswer>) {
    return fakeBackendByPath((path, init) => routes[`${init?.method ?? 'GET'} ${path.split('?')[0] ?? ''}`] ?? { status: 500 });
}

/** Show the own profile with the settings open and the account loaded. */
function showSettings(account: Account = ACCOUNT): void {
    profileStore.update({ view: 'ready', profile: profile({ username: 'duvan', relation: 'self' }), receivedAt: Date.now(), panel: 'settings' });
    followingStore.update({ surface: 'ready', hasLoaded: true });
    settingsStore.update({ account, accountLoad: 'ready', section: 'username' });
}

/** Return the navigation of the settings. */
function nav(): HTMLElement {
    return screen.getByRole('navigation', { name: 'Settings' });
}

beforeEach(() => {
    authStore.update({ accessToken: 'token', userId: 1, username: 'duvan' });
    screenStore.set({ screen: 'profile' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('the settings panel', () => {
    it('takes the place of the data and the list, beside the card', () => {
        showSettings();
        const { container } = render(<ProfileScreen />);
        expect(screen.getByRole('region', { name: 'Settings' })).toBeInTheDocument();
        expect(screen.getByRole('complementary', { name: 'duvan' })).toBeInTheDocument();
        expect(container.querySelector('.profile-data')).toBeNull();
        expect(container.querySelector('.following-card')).toBeNull();
    });

    it('opens from the gear of the own card, and closes with the same button', async () => {
        backend({ 'GET account': { status: 200, body: { success: true, account: ACCOUNT } } });
        profileStore.update({ view: 'ready', profile: profile({ username: 'duvan', relation: 'self' }), receivedAt: Date.now() });
        followingStore.update({ surface: 'ready', hasLoaded: true });
        const { container } = render(<ProfileScreen />);
        const gear = screen.getByRole('button', { name: 'Settings' });
        expect(gear).toHaveAttribute('aria-pressed', 'false');
        await userEvent.click(gear);
        expect(screen.getByRole('region', { name: 'Settings' })).toBeInTheDocument();
        expect(gear).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(gear);
        expect(container.querySelector('.settings-panel')).toBeNull();
        expect(container.querySelector('.following-card')).not.toBeNull();
    });

    it('closes with Escape, but not while the user writes in a field', async () => {
        showSettings();
        render(<ProfileScreen />);
        await userEvent.click(screen.getByRole('textbox', { name: 'Username' }));
        await userEvent.keyboard('{Escape}');
        expect(profileStore.get().panel).toBe('settings');
        await userEvent.click(screen.getByRole('button', { name: 'Language' }));
        await userEvent.keyboard('{Escape}');
        expect(profileStore.get().panel).toBe('profile');
    });

    it('lists the options in order, with the logout last, and marks the one that shows', () => {
        showSettings();
        render(<ProfileScreen />);
        const buttons = within(nav()).getAllByRole('button');
        expect(buttons.map(/** Read a button. */ (button) => button.textContent)).toEqual([
            'Username', 'Password', 'Privacy', 'Blocked users', 'Language', 'Send feedback', 'Logout'
        ]);
        expect(buttons.filter(/** Keep the marked buttons. */ (button) => button.getAttribute('aria-current') === 'page').map(/** Read a button. */ (button) => button.textContent)).toEqual(['Username']);
    });

    it('shows each option when it is chosen', async () => {
        backend({ 'GET blocks': { status: 200, body: { success: true, blocked: [] } } });
        showSettings();
        render(<ProfileScreen />);
        for (const [option, heading] of [
            ['Password', 'Password'], ['Privacy', 'Account privacy'], ['Blocked users', 'Blocked users'], ['Language', 'Language'], ['Send feedback', 'Send feedback']
        ] as const) {
            await userEvent.click(within(nav()).getByRole('button', { name: option }));
            expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
        }
    });

    it('asks before it logs the user out', async () => {
        showSettings();
        render(<ProfileScreen />);
        await userEvent.click(within(nav()).getByRole('button', { name: 'Logout' }));
        expect(confirmStore.get().request?.message).toBe('Are you sure you want to log out?');
    });

    it('shows placeholders while the account loads, and an error with a retry', async () => {
        showSettings();
        settingsStore.update({ accountLoad: 'loading', account: null });
        const { unmount } = render(<ProfileScreen />);
        expect(screen.getByRole('status', { name: 'Loading settings' })).toBeInTheDocument();
        unmount();
        const fake = backend({ 'GET account': { status: 200, body: { success: true, account: ACCOUNT } } });
        settingsStore.update({ accountLoad: 'error' });
        render(<ProfileScreen />);
        expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load your settings.");
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(fake).toHaveBeenCalledTimes(1);
        expect(await screen.findByRole('textbox', { name: 'Username' })).toBeInTheDocument();
    });
});

describe('the username form', () => {
    it('shows the username and says that it can change once every 30 days', () => {
        showSettings();
        render(<ProfileScreen />);
        expect(screen.getByRole('textbox', { name: 'Username' })).toHaveValue('duvan');
        expect(screen.getByText('You can change it once every 30 days.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('saves a new username, and then says when it can change again', async () => {
        const account: Account = { username: 'new', is_private: false, username_next_change_at: '2026-12-15T12:00:00.000' };
        const fake = backend({ 'PATCH account/username': { status: 200, body: { success: true, account } }, 'GET users/new': { status: 500 } });
        showSettings();
        render(<ProfileScreen />);
        await userEvent.clear(screen.getByRole('textbox', { name: 'Username' }));
        await userEvent.type(screen.getByRole('textbox', { name: 'Username' }), 'new');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText('Username changed.')).toBeInTheDocument();
        expect(jsonBodyOf(fake.mock.calls[0]?.[1])).toEqual({ username: 'new' });
        expect(screen.getByText('You changed it recently. You can change it again on Tue, Dec 15.')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Username' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('is locked, with the day it can change again, when the username changed recently', () => {
        showSettings({ ...ACCOUNT, username_next_change_at: '2099-12-15T12:00:00.000' });
        render(<ProfileScreen />);
        expect(screen.getByRole('textbox', { name: 'Username' })).toBeDisabled();
        expect(screen.getByText(/You changed it recently/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('shows the error under the field, and clears it when the user writes again', async () => {
        backend({ 'PATCH account/username': { status: 409, body: { success: false, error: 'Username already in use' } } });
        showSettings();
        render(<ProfileScreen />);
        await userEvent.clear(screen.getByRole('textbox', { name: 'Username' }));
        await userEvent.type(screen.getByRole('textbox', { name: 'Username' }), 'lucia');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText('That username is already in use.')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Username' })).toBeInvalid();
        await userEvent.type(screen.getByRole('textbox', { name: 'Username' }), 'x');
        expect(screen.queryByText('That username is already in use.')).toBeNull();
    });

    it('asks for a username when the field is empty', async () => {
        showSettings();
        render(<ProfileScreen />);
        await userEvent.clear(screen.getByRole('textbox', { name: 'Username' }));
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(await screen.findByText('Enter a username.')).toBeInTheDocument();
    });
});

describe('the password form', () => {
    /** Open the password option. */
    async function openPassword(): Promise<void> {
        showSettings();
        render(<ProfileScreen />);
        await userEvent.click(within(nav()).getByRole('button', { name: 'Password' }));
    }

    /** Write in the three fields. */
    async function fill(current: string, next: string, confirmation: string): Promise<void> {
        await userEvent.type(screen.getByLabelText('Current password'), current);
        await userEvent.type(screen.getByLabelText('New password'), next);
        await userEvent.type(screen.getByLabelText('Confirm new password'), confirmation);
    }

    it('has three password fields, the rule for the new one, and says that the other devices sign out', async () => {
        await openPassword();
        for (const name of ['Current password', 'New password', 'Confirm new password']) expect(screen.getByLabelText(name)).toHaveAttribute('type', 'password');
        expect(screen.getByText('12+ characters: uppercase, lowercase, number and symbol.')).toBeInTheDocument();
        expect(screen.getByText('Changing it signs you out of your other devices.')).toBeInTheDocument();
    });

    it('shows and hides the password of a field', async () => {
        await openPassword();
        await userEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0] as HTMLElement);
        expect(screen.getByLabelText('Current password')).toHaveAttribute('type', 'text');
    });

    it('shows each problem under its own field', async () => {
        await openPassword();
        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
        expect(await screen.findByText('Enter your current password.')).toBeInTheDocument();
        expect(screen.getByLabelText('Current password')).toBeInvalid();
        await fill('old-password', 'short', 'short');
        expect(screen.queryByText('Enter your current password.')).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
        expect(await screen.findByText('At least 12 characters.')).toBeInTheDocument();
        expect(screen.getByLabelText('New password')).toBeInvalid();
    });

    it('says when the passwords do not match, and when the current one is wrong', async () => {
        backend({ 'PATCH account/password': { status: 403, body: { success: false, error: 'Current password is incorrect' } } });
        await openPassword();
        await fill('wrong', 'Brand-new-pass-1', 'Brand-new-pass-2');
        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
        expect(await screen.findByText("The passwords don't match.")).toBeInTheDocument();
        await userEvent.clear(screen.getByLabelText('Confirm new password'));
        await userEvent.type(screen.getByLabelText('Confirm new password'), 'Brand-new-pass-1');
        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
        expect(await screen.findByText('The current password is not correct.')).toBeInTheDocument();
        expect(screen.getByLabelText('Current password')).toBeInvalid();
    });

    it('changes the password, empties the fields, and says so', async () => {
        const fake = backend({ 'PATCH account/password': { status: 200, body: { success: true, message: 'ok', user_id: 1, access_token: 'new-token', username: 'duvan' } } });
        await openPassword();
        await fill('old-password-1', 'Brand-new-pass-1', 'Brand-new-pass-1');
        await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
        expect(await screen.findByText('Password changed.')).toBeInTheDocument();
        expect(screen.getByLabelText('Current password')).toHaveValue('');
        expect(screen.getByLabelText('New password')).toHaveValue('');
        expect(fake).toHaveBeenCalledTimes(1);
        expect(authStore.get().accessToken).toBe('new-token');
    });
});

describe('the privacy choice', () => {
    /** Open the privacy option. */
    async function openPrivacy(account: Account = ACCOUNT): Promise<void> {
        showSettings(account);
        render(<ProfileScreen />);
        await userEvent.click(within(nav()).getByRole('button', { name: 'Privacy' }));
    }

    it('shows which choice is the account', async () => {
        await openPrivacy({ ...ACCOUNT, is_private: true });
        expect(screen.getByRole('radio', { name: /^Public/ })).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByRole('radio', { name: /^Private/ })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByText('People who want to follow you send a request. Your current followers stay.')).toBeInTheDocument();
    });

    it('saves a new choice at once, and says so', async () => {
        const fake = backend({ 'PATCH account/privacy': { status: 200, body: { success: true, is_private: true } }, 'GET users/duvan': { status: 500 } });
        await openPrivacy();
        await userEvent.click(screen.getByRole('radio', { name: /^Private/ }));
        expect(await screen.findByText('Change saved.')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /^Private/ })).toHaveAttribute('aria-checked', 'true');
        expect(jsonBodyOf(fake.mock.calls[0]?.[1])).toEqual({ isPrivate: true });
    });

    it('asks nothing when the user chooses what is already chosen', async () => {
        const fake = backend({});
        await openPrivacy();
        await userEvent.click(screen.getByRole('radio', { name: /^Public/ }));
        expect(fake).not.toHaveBeenCalled();
    });

    it('says when the change fails, and keeps the choice', async () => {
        backend({});
        await openPrivacy();
        await userEvent.click(screen.getByRole('radio', { name: /^Private/ }));
        expect(await screen.findByText("That didn't work. Try again.")).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /^Public/ })).toHaveAttribute('aria-checked', 'true');
    });
});

describe('the blocked users', () => {
    /** Open the blocked users option, with an answer for their list. */
    async function openBlocked(answer: FakeAnswer): Promise<void> {
        backend({ 'GET blocks': answer });
        showSettings();
        render(<ProfileScreen />);
        await userEvent.click(within(nav()).getByRole('button', { name: 'Blocked users' }));
    }

    it('lists them, each with the button that unblocks', async () => {
        await openBlocked({ status: 200, body: { success: true, blocked: [{ username: 'ana' }, { username: 'jose' }] } });
        expect(await screen.findByText('ana')).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Unblock' })).toHaveLength(2);
    });

    it('invites nothing when nobody is blocked', async () => {
        await openBlocked({ status: 200, body: { success: true, blocked: [] } });
        expect(await screen.findByText("You haven't blocked anyone")).toBeInTheDocument();
        expect(screen.getByText('People you block will appear here.')).toBeInTheDocument();
    });

    it('shows placeholders while it loads, and an error with a retry', async () => {
        await openBlocked({ status: 500 });
        expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your settings.");
        backend({ 'GET blocks': { status: 200, body: { success: true, blocked: [{ username: 'ana' }] } } });
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(await screen.findByText('ana')).toBeInTheDocument();
    });

    it('asks before it unblocks someone', async () => {
        await openBlocked({ status: 200, body: { success: true, blocked: [{ username: 'ana' }] } });
        await userEvent.click(await screen.findByRole('button', { name: 'Unblock' }));
        expect(confirmStore.get().request).toMatchObject({ message: 'Unblock ana?', confirmLabel: 'Unblock' });
    });
});

describe('the language choice', () => {
    it('shows both languages, marks the one that shows, and changes the app when the other is chosen', async () => {
        showSettings();
        render(<ProfileScreen />);
        await userEvent.click(within(nav()).getByRole('button', { name: 'Language' }));
        expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: 'Español' })).toHaveAttribute('aria-checked', 'false');
        await userEvent.click(screen.getByRole('radio', { name: 'Español' }));
        expect(languageStore.get().language).toBe('es');
        expect(localStorage.getItem('executionOS_language')).toBe('es');
        expect(screen.getByRole('radio', { name: 'Español' })).toHaveAttribute('aria-checked', 'true');
        expect(within(screen.getByRole('navigation', { name: 'Ajustes' })).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    });
});

describe('the feedback form', () => {
    /** Open the feedback option. */
    async function openFeedback(): Promise<void> {
        showSettings();
        render(<ProfileScreen />);
        await userEvent.click(within(nav()).getByRole('button', { name: 'Send feedback' }));
    }

    it('has a labelled text box and one button', async () => {
        await openFeedback();
        expect(screen.getByLabelText('Your feedback')).toBeInstanceOf(HTMLTextAreaElement);
        expect(screen.getByRole('button', { name: 'Send Feedback' })).toHaveAttribute('type', 'submit');
    });

    it('asks for a message when the text box is empty, and marks it as invalid', async () => {
        await openFeedback();
        await userEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));
        expect(await screen.findByText('Write a message before sending.')).toBeInTheDocument();
        expect(screen.getByLabelText('Your feedback')).toBeInvalid();
        expect(screen.getByLabelText('Your feedback')).toHaveFocus();
    });

    it('sends the message, empties the text box, and says thanks', async () => {
        const fake = backend({ 'POST feedback': { status: 200, body: { success: true, message: 'ok' } } });
        await openFeedback();
        fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'Love the profile' } });
        await userEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));
        expect(await screen.findByText('Feedback sent. Thank you!')).toBeInTheDocument();
        expect(screen.getByLabelText('Your feedback')).toHaveValue('');
        expect(jsonBodyOf(fake.mock.calls[0]?.[1])).toEqual({ message: 'Love the profile' });
    });

    it('keeps the message when it cannot be sent', async () => {
        backend({});
        await openFeedback();
        fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'Love the profile' } });
        await userEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));
        expect(await screen.findByText('Couldn’t send your feedback. Please try again.')).toBeInTheDocument();
        expect(screen.getByLabelText('Your feedback')).toHaveValue('Love the profile');
    });

    it('keeps what was written while the user visits another option', async () => {
        await openFeedback();
        fireEvent.change(screen.getByLabelText('Your feedback'), { target: { value: 'Half written' } });
        await userEvent.click(within(nav()).getByRole('button', { name: 'Language' }));
        await userEvent.click(within(nav()).getByRole('button', { name: 'Send feedback' }));
        expect(screen.getByLabelText('Your feedback')).toHaveValue('Half written');
        expect(feedbackStore.get().draft).toBe('Half written');
    });
});
