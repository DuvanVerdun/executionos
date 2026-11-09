// Screen transitions. Features add their own steps through hooks.

import { screenDom } from './screens.js';

const SCREEN_DISPLAY = {
    loading: 'flex', register: 'grid', login: 'grid',
    plan: 'flex', focus: 'flex', review: 'grid', dashboard: 'flex', rooms: 'flex', room: 'flex'
};

const ALLOWED_SCREEN_TRANSITIONS = {
    loading: ['register', 'login'],
    register: ['loading', 'login'],
    login: ['register', 'plan', 'focus', 'review', 'dashboard', 'rooms', 'room'],
    plan: ['loading', 'register', 'login', 'dashboard', 'rooms'],
    focus: ['loading', 'login', 'register', 'plan', 'review', 'room'],
    review: ['loading', 'login', 'register', 'focus'],
    dashboard: ['plan', 'review', 'rooms'],
    rooms: ['loading', 'register', 'login', 'plan', 'dashboard', 'room'],
    room: ['loading', 'register', 'login', 'rooms', 'review', 'focus']
};

const beforeSwitchHooks = [];
const afterSwitchHooks = [];

/** Add a step that runs before the screens switch, after the transition is allowed. Steps run in the order they were added. */
export function addBeforeSwitchHook(hook) {
    beforeSwitchHooks.push(hook);
}

/** Add a step that runs after the screens switch. Steps run in the order they were added. */
export function addAfterSwitchHook(hook) {
    afterSwitchHooks.push(hook);
}

/** Apply an allowed screen transition and prepare its presentation. */
export function navigateTo(nextScreen, currentScreen) {
    if (!ALLOWED_SCREEN_TRANSITIONS[nextScreen]?.includes(currentScreen)) return;
    for (const hook of beforeSwitchHooks) hook(nextScreen, currentScreen);
    screenDom[currentScreen].screen.style.display = 'none';
    screenDom[nextScreen].screen.style.display = SCREEN_DISPLAY[nextScreen];
    document.body.dataset.screen = nextScreen;
    for (const hook of afterSwitchHooks) hook(nextScreen, currentScreen);
}
