import { createStore } from '../lib/store';
import type { HeaderScreenName } from '../types/screens';

export const userMenuStore = createStore<{ openScreen: HeaderScreenName | null }>({ openScreen: null });

/** Open the account menu of a header, or close it when it is open. */
export function toggleUserMenu(screen: HeaderScreenName): void {
    userMenuStore.set({ openScreen: userMenuStore.get().openScreen === null ? screen : null });
}

/** Close the account menu. */
export function closeUserMenu(): void {
    userMenuStore.set({ openScreen: null });
}
