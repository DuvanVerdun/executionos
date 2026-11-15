import { setAuthenticatedUser } from '../../auth/identity';
import { authStore } from '../../auth/state';
import { t } from '../../i18n/i18n';
import { formatShortDate, parseServerTime } from '../../lib/dates';
import { getPasswordError } from '../../lib/validation';
import { confirmAction } from '../../shared/confirm';
import { setFloatingMessage } from '../../shared/floating-message';
import type { Account } from '../../types/social';
import { clearSearch, loadProfile } from '../profile';
import { profileStore } from '../state';
import { deleteBlock, fetchAccount, fetchBlocks, patchPassword, patchPrivacy, patchUsername } from './api';
import { settingsStore, type SettingsSection } from './state';

/** The longest username the server accepts. */
export const USERNAME_MAX_LENGTH = 50;

/** How a change of the settings ended: saved, or with the message to show. */
export type SettingsOutcome = { kind: 'saved' } | { kind: 'error'; message: string };

const SAVED = { kind: 'saved' } as const;

/** Return the outcome of a change that failed with a message. */
function failure(message: string): SettingsOutcome {
    return { kind: 'error', message };
}

/** Report whether the username cannot be changed now, because it was changed in the last 30 days. */
export function isUsernameLocked(account: Account, nowMs: number): boolean {
    return account.username_next_change_at !== null && parseServerTime(account.username_next_change_at) > nowMs;
}

/** Return the day when the username can be changed again, written for the language the app shows. */
export function formatUsernameChangeDay(nextChangeAt: string): string {
    return formatShortDate(new Date(parseServerTime(nextChangeAt)));
}

/** Load the settings of the account. */
export async function loadAccount(): Promise<void> {
    settingsStore.update({ accountLoad: 'loading' });
    try {
        const result = await fetchAccount();
        if (!result.success) throw new Error(result.error);
        settingsStore.update({ account: result.account, accountLoad: 'ready' });
    } catch (error) {
        console.error('Account loading error:', error);
        settingsStore.update({ accountLoad: 'error' });
    }
}

/** Load the users that the user blocked. */
export async function loadBlocked(): Promise<void> {
    settingsStore.update({ blockedLoad: 'loading' });
    try {
        const result = await fetchBlocks();
        if (!result.success) throw new Error(result.error);
        settingsStore.update({ blocked: result.blocked, blockedLoad: 'ready' });
    } catch (error) {
        console.error('Blocked users loading error:', error);
        settingsStore.update({ blockedLoad: 'error' });
    }
}

/** Show the settings in the place of the data and the list, and load them. */
export function openSettings(): void {
    clearSearch();
    profileStore.update({ panel: 'settings' });
    settingsStore.update({ section: 'username' });
    void loadAccount();
}

/** Show the profile again. */
export function closeSettings(): void {
    profileStore.update({ panel: 'profile' });
}

/** Show one option of the settings. The blocked users are loaded when their option opens. */
export function selectSection(section: SettingsSection): void {
    settingsStore.update({ section });
    if (section === 'blocked') void loadBlocked();
}

/** Change the username. It can only change once every 30 days. */
export async function changeUsername(raw: string): Promise<SettingsOutcome> {
    const username = raw.trim();
    if (username === '') return failure(t('settings.usernameRequired'));
    if (username.length > USERNAME_MAX_LENGTH) return failure(t('settings.usernameTooLong'));
    try {
        const result = await patchUsername(username);
        if (result.success) {
            settingsStore.update({ account: result.account });
            authStore.update({ username: result.account.username });
            void loadProfile({ silent: true });
            return SAVED;
        }
        if (result.status === 409) {
            const account = settingsStore.get().account;
            if ('next_change_at' in result && typeof result.next_change_at === 'string' && account !== null) {
                settingsStore.update({ account: { ...account, username_next_change_at: result.next_change_at } });
                return failure(t('settings.usernameLocked', { date: formatUsernameChangeDay(result.next_change_at) }));
            }
            return failure(t('settings.usernameTaken'));
        }
        throw new Error(result.error);
    } catch (error) {
        console.error('Username change error:', error);
        return failure(t('settings.actionFailed'));
    }
}

/** The field of a password change that a message is about, or the whole form. */
export type PasswordField = 'current' | 'new' | 'confirm' | 'form';

/** How a change of the password ended: saved, or with the message and the field it is about. */
export type PasswordOutcome = { kind: 'saved' } | { kind: 'error'; field: PasswordField; message: string };

/** Return the outcome of a change of the password that failed. */
function passwordFailure(field: PasswordField, message: string): PasswordOutcome {
    return { kind: 'error', field, message };
}

/** Change the password. The other sessions end, and this one goes on with the credentials that the server sends. */
export async function changePassword(current: string, next: string, confirmation: string): Promise<PasswordOutcome> {
    if (current === '') return passwordFailure('current', t('settings.currentPasswordRequired'));
    const weakness = getPasswordError(next);
    if (weakness !== '') return passwordFailure('new', weakness);
    if (next !== confirmation) return passwordFailure('confirm', t('settings.passwordMismatch'));
    try {
        const result = await patchPassword(current, next);
        if (result.success) {
            setAuthenticatedUser(result);
            return SAVED;
        }
        if (result.status === 403) return passwordFailure('current', t('settings.passwordWrong'));
        throw new Error(result.error);
    } catch (error) {
        console.error('Password change error:', error);
        return passwordFailure('form', t('settings.actionFailed'));
    }
}

/** Make the account private or public. */
export async function changePrivacy(isPrivate: boolean): Promise<SettingsOutcome> {
    try {
        const result = await patchPrivacy(isPrivate);
        if (!result.success) throw new Error(result.error);
        const account = settingsStore.get().account;
        if (account !== null) settingsStore.update({ account: { ...account, is_private: result.is_private } });
        void loadProfile({ silent: true });
        return SAVED;
    } catch (error) {
        console.error('Privacy change error:', error);
        return failure(t('settings.actionFailed'));
    }
}

/** After the user confirms, unblock a user and take them off the list. */
export async function unblockUser(username: string): Promise<void> {
    const confirmed = await confirmAction({
        message: t('settings.unblockConfirm', { username }),
        details: [t('settings.unblockDetail')],
        confirmLabel: t('settings.unblock')
    });
    if (!confirmed) return;
    try {
        const result = await deleteBlock(username);
        if (!result.success) throw new Error(result.error);
        settingsStore.update({ blocked: settingsStore.get().blocked.filter(/** Keep the users who are still blocked. */ (user) => user.username !== username) });
    } catch (error) {
        console.error('Unblock error:', error);
        setFloatingMessage(t('settings.actionFailed'), { error: true });
    }
}
