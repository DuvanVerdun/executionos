import { loadDashboard } from '../dashboard/dashboard';
import { enterRoomsScreen } from '../rooms/rooms';
import type { HeaderScreenName } from '../types/screens';
import { navigateTo } from './navigation';

/** Go from one header screen to another, and load the data that the target screen needs. */
export async function goToHeaderScreen(target: HeaderScreenName, current: HeaderScreenName): Promise<void> {
    if (target === current) return;
    navigateTo(target, current);
    if (target === 'dashboard') await loadDashboard();
    if (target === 'rooms') await enterRoomsScreen();
}
