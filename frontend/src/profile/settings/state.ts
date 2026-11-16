import { createStore } from '../../lib/store';
import type { Account, BlockedUser } from '../../types/social';

/** The options of the settings, in the order of their column. The logout is an action and has no section. */
export type SettingsSection = 'username' | 'password' | 'privacy' | 'blocked' | 'language' | 'feedback';

/** What a part of the settings shows: placeholders, its content, or an error. */
export type SettingsLoad = 'loading' | 'ready' | 'error';

interface SettingsState {
    section: SettingsSection;
    account: Account | null;
    accountLoad: SettingsLoad;
    blocked: BlockedUser[];
    blockedLoad: SettingsLoad;
}

export const settingsStore = createStore<SettingsState>({
    section: 'username',
    account: null,
    accountLoad: 'loading',
    blocked: [],
    blockedLoad: 'loading'
});
