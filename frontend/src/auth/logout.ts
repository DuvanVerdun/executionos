import { t } from '../i18n/i18n';
import { clearLastScreen } from '../shared/last-screen';
import { navigateTo } from '../shared/navigation';
import type { ScreenName } from '../types/screens';
import { logout } from './api';
import { clearAuthenticatedUser } from './identity';

/** End the authenticated session and return to registration. */
export async function handleLogout(currentScreen: ScreenName): Promise<void> {
    if (!confirm(t('auth.logoutConfirm'))) return;
    try {
        await logout();
        clearAuthenticatedUser();
        clearLastScreen();
        navigateTo('login', currentScreen);
    } catch {
        alert(t('auth.logoutFailed'));
    }
}
