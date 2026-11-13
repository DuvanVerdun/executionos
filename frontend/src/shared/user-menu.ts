import { createStore } from '../lib/store';
import type { HeaderScreenName } from '../types/screens';

/** Which header has its account menu open, and whether the language menu beside it is open too. */
export const userMenuStore = createStore<{ openScreen: HeaderScreenName | null; isLanguageMenuOpen: boolean }>({
    openScreen: null,
    isLanguageMenuOpen: false
});

/** Open the account menu of a header, or close it when it is open. */
export function toggleUserMenu(screen: HeaderScreenName): void {
    userMenuStore.set({ openScreen: userMenuStore.get().openScreen === null ? screen : null, isLanguageMenuOpen: false });
}

/** Close the account menu, and the language menu with it. */
export function closeUserMenu(): void {
    userMenuStore.set({ openScreen: null, isLanguageMenuOpen: false });
}

/** Open the language menu, or close it when it is open. */
export function toggleLanguageMenu(): void {
    userMenuStore.update({ isLanguageMenuOpen: !userMenuStore.get().isLanguageMenuOpen });
}
