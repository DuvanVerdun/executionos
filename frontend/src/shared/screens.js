// Which elements belong to which screen.

import { loginDom, registerDom } from '../auth/dom.js';
import { dashboardDom } from '../dashboard/dom.js';
import { roomDom, roomsDom } from '../rooms/dom.js';
import { focusDom, planDom, reviewDom } from '../session/dom.js';
import { loadingDom } from './dom.js';

/** The element group of each screen, by screen name. */
export const screenDom = {
    loading: loadingDom,
    register: registerDom,
    login: loginDom,
    plan: planDom,
    focus: focusDom,
    review: reviewDom,
    dashboard: dashboardDom,
    rooms: roomsDom,
    room: roomDom
};

/** Return the name of the screen that is showing now. */
export function getCurrentScreenName() {
    return document.body.dataset.screen ?? 'loading';
}

export const HEADER_SCREENS = ['plan', 'dashboard', 'rooms'];
