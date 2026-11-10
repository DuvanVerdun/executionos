import { loadDashboard } from '../dashboard/dashboard';
import { enterRoomsScreen } from '../rooms/rooms';
import type { HeaderScreenName, ScreenName } from '../types/screens';
import { navigateTo } from './navigation';

/** Go from the current screen to a header screen, and load the data that the target screen needs. */
export async function goToHeaderScreen(target: HeaderScreenName, current: ScreenName): Promise<void> {
    if (target === current) return;
    navigateTo(target, current);
    if (target === 'dashboard') await loadDashboard();
    if (target === 'rooms') await enterRoomsScreen();
}
