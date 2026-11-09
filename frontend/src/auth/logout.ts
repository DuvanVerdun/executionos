import { navigateTo } from '../shared/navigation';
import type { ScreenName } from '../types/screens';
import { logout } from './api';
import { clearAuthenticatedUser } from './identity';

/** End the authenticated session and return to registration. */
export async function handleLogout(currentScreen: ScreenName): Promise<void> {
    if (!confirm('Are you sure you want to log out?')) return;
    try {
        await logout();
        clearAuthenticatedUser();
        navigateTo('login', currentScreen);
    } catch {
        alert('An unexpected network/server connection error occurred');
    }
}
