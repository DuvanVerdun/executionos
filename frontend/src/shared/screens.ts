// Which elements belong to which screen.

import { isScreenName } from '../types/screens';
import type { HeaderScreenName, ScreenName } from '../types/screens';
import { loginDom, registerDom } from '../auth/dom';
import { dashboardDom } from '../dashboard/dom';
import { roomDom, roomsDom } from '../rooms/dom';
import { focusDom, planDom, reviewDom } from '../session/dom';
import { loadingDom } from './dom';

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
export function getCurrentScreenName(): ScreenName {
    const name = document.body.dataset.screen;
    return isScreenName(name) ? name : 'loading';
}

export const HEADER_SCREENS: HeaderScreenName[] = ['plan', 'dashboard', 'rooms'];
