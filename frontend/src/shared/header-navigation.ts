import { loadDashboard } from '../dashboard/dashboard';
import { enterProfileScreen, openOwnProfile } from '../profile/profile';
import { enterRoomsScreen } from '../rooms/rooms';
import type { HeaderScreenName, ScreenName } from '../types/screens';
import { navigateTo } from './navigation';

/** Go from the current screen to a header screen, and load the data that the target screen needs. The Profile always opens the user's own. */
export async function goToHeaderScreen(target: HeaderScreenName, current: ScreenName): Promise<void> {
    if (target === current) {
        if (target === 'profile') await openOwnProfile();
        return;
    }
    navigateTo(target, current);
    if (target === 'dashboard') await loadDashboard();
    if (target === 'rooms') await enterRoomsScreen();
    if (target === 'profile') await enterProfileScreen();
}
