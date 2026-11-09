// The account menu in the screen headers.

import { dashboardDom } from '../dashboard/dom.js';
import { roomsDom } from '../rooms/dom.js';
import { planDom } from '../session/dom.js';
import { HEADER_SCREENS, screenDom } from './screens.js';

/** Whether an account menu is open. Navigation reads it to close the menu when the screen changes. */
export const userMenuState = {
    isOpened: false
};

/** Toggle the account menu for the selected screen. */
export function toggleUserMenu(screen) {
    const menu = screenDom[screen].userMenu;
    if (userMenuState.isOpened) {
        menu.style.display = 'none';
        userMenuState.isOpened = false;
        return;
    }
    menu.style.display = 'flex';
    userMenuState.isOpened = true;
}

/** Close account menus when a click occurs outside their controls. */
function closeUserMenusOnOutsideClick(event) {
    if (!userMenuState.isOpened) return;
    const clickedInsideHeaderMenu = HEADER_SCREENS.some(/** Check whether the click hit this screen's account menu or icon. */ (screen) =>
        screenDom[screen].userMenu.contains(event.target) || screenDom[screen].userIcon.contains(event.target)
    );
    if (clickedInsideHeaderMenu) return;
    HEADER_SCREENS.forEach(/** Close this screen's account menu. */ (screen) => {
        screenDom[screen].userMenu.style.display = 'none';
    });
    userMenuState.isOpened = false;
}

/** Connect the account menu icons and close them on outside clicks. */
export function initUserMenu() {
    planDom.userIcon.addEventListener('click', /** Toggle the Plan account menu. */ () => toggleUserMenu('plan'));
    dashboardDom.userIcon.addEventListener('click', /** Toggle the Dashboard account menu. */ () => toggleUserMenu('dashboard'));
    roomsDom.userIcon.addEventListener('click', /** Toggle the Rooms account menu. */ () => toggleUserMenu('rooms'));
    document.addEventListener('click', closeUserMenusOnOutsideClick);
}
