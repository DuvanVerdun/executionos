export const SCREEN_NAMES = [
    'loading', 'landing', 'register', 'login', 'plan', 'focus', 'review', 'streak', 'dashboard', 'rooms', 'room', 'profile'
] as const;

export type ScreenName = typeof SCREEN_NAMES[number];

/** Screens that show the streak button and the way to the Profile in their header. */
export type HeaderScreenName = 'plan' | 'dashboard' | 'rooms' | 'profile';

/** The screens that the navigation buttons of a header lead to. */
export type NavigationScreenName = Exclude<HeaderScreenName, 'profile'>;

/** Report whether a string is the name of a screen. */
export function isScreenName(value: string | undefined): value is ScreenName {
    return SCREEN_NAMES.some(/** Compare with one known screen name. */ (name) => name === value);
}

/** Report whether a string is the name of a screen with a header. */
export function isHeaderScreenName(value: string | undefined): value is HeaderScreenName {
    return value === 'plan' || value === 'dashboard' || value === 'rooms' || value === 'profile';
}

/** The navigation buttons of a header, in order. */
export const NAVIGATION_SCREENS: readonly NavigationScreenName[] = ['plan', 'dashboard', 'rooms'];
