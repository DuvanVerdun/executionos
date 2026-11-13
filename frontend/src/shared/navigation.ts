import { createStore } from '../lib/store';
import type { ScreenName } from '../types/screens';

/** A step that runs when the screen changes. */
type SwitchHook = (nextScreen: ScreenName, currentScreen: ScreenName) => void;

/** How each screen is laid out when it shows. */
export const SCREEN_DISPLAY: Record<ScreenName, string> = {
    loading: 'flex', landing: 'block', register: 'grid', login: 'grid',
    plan: 'flex', focus: 'flex', review: 'grid', dashboard: 'flex', rooms: 'flex', room: 'flex'
};

const ALLOWED_SCREEN_TRANSITIONS: Record<ScreenName, readonly ScreenName[]> = {
    loading: ['register', 'login'],
    landing: ['loading', 'plan', 'dashboard', 'rooms'],
    register: ['loading', 'landing', 'login'],
    login: ['landing', 'register', 'plan', 'focus', 'review', 'dashboard', 'rooms', 'room'],
    plan: ['loading', 'register', 'login', 'dashboard', 'rooms'],
    focus: ['loading', 'login', 'register', 'plan', 'review', 'room'],
    review: ['loading', 'login', 'register', 'focus'],
    dashboard: ['loading', 'register', 'login', 'plan', 'review', 'rooms'],
    rooms: ['loading', 'register', 'login', 'plan', 'dashboard', 'room'],
    room: ['loading', 'register', 'login', 'rooms', 'review', 'focus']
};

/** The screen that shows now. */
export const screenStore = createStore<{ screen: ScreenName }>({ screen: 'loading' });

const beforeSwitchHooks: SwitchHook[] = [];

/** Return the name of the screen that is showing now. */
export function getCurrentScreenName(): ScreenName {
    return screenStore.get().screen;
}

/** Add a step that runs before the screen changes, after the transition is allowed. Steps run in the order they were added. */
export function addBeforeSwitchHook(hook: SwitchHook): void {
    beforeSwitchHooks.push(hook);
}

/** Apply an allowed screen transition. */
export function navigateTo(nextScreen: ScreenName, currentScreen: ScreenName): void {
    if (!ALLOWED_SCREEN_TRANSITIONS[nextScreen].includes(currentScreen)) return;
    for (const hook of beforeSwitchHooks) hook(nextScreen, currentScreen);
    screenStore.update({ screen: nextScreen });
}
