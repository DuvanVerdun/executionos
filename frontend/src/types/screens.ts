// Screen names, shared by navigation, DOM lookup and every screen's code.

export const SCREEN_NAMES = [
    'loading', 'register', 'login', 'plan', 'focus', 'review', 'dashboard', 'rooms', 'room'
] as const;

export type ScreenName = typeof SCREEN_NAMES[number];

/** Screens that show the account menu and the streak button in their header. */
export type HeaderScreenName = 'plan' | 'dashboard' | 'rooms';

/** Report whether a string is the name of a screen. */
export function isScreenName(value: string | undefined): value is ScreenName {
    return SCREEN_NAMES.some(/** Compare with one known screen name. */ (name) => name === value);
}

/** Report whether a string is the name of a screen with an account menu and a streak button. */
export function isHeaderScreenName(value: string | undefined): value is HeaderScreenName {
    return value === 'plan' || value === 'dashboard' || value === 'rooms';
}
