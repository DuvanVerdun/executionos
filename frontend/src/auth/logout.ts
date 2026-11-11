import { t } from '../i18n/i18n';
import { confirmAction } from '../shared/confirm';
import { setFloatingMessage } from '../shared/floating-message';
import { clearLastScreen } from '../shared/last-screen';
import { navigateTo } from '../shared/navigation';
import type { ScreenName } from '../types/screens';
import { logout } from './api';
import { clearAuthenticatedUser } from './identity';

/** End the authenticated session and return to registration. */
export async function handleLogout(currentScreen: ScreenName): Promise<void> {
    if (!await confirmAction({ message: t('auth.logoutConfirm'), confirmLabel: t('header.logout') })) return;
    try {
        await logout();
        clearAuthenticatedUser();
        clearLastScreen();
        navigateTo('login', currentScreen);
    } catch {
        setFloatingMessage(t('auth.logoutFailed'), { error: true });
    }
}
