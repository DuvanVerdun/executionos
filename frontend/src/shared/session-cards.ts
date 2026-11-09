// Parts shared by the Dashboard and Room session history cards.

import { closestElement, getAllElements, getElement, getParentElement, requireClosest } from '../lib/dom';
import { formatDurationHoursMinutes } from '../lib/durations';
import { deleteSession } from '../session/api';
import type { ScreenName } from '../types/screens';
import type { HistorySession } from '../types/session';

/** Create a session's target, focused time, and completion metrics. */
export function createSessionTimeSection(
    session: Pick<HistorySession, 'target_time_seconds' | 'actual_time_seconds' | 'percentage_completed'>
): HTMLDivElement {
    const container = document.createElement('div');
    const targetTime = document.createElement('p');
    const actualTime = document.createElement('p');
    const percentage = document.createElement('p');

    container.className = 'dashboard-session-time-and-percentage-container';
    targetTime.className = 'dashboard-session-target-time';
    actualTime.className = 'dashboard-session-actual-time';
    percentage.className = 'dashboard-session-percentage';

    targetTime.textContent = `${formatDurationHoursMinutes(session.target_time_seconds)} target`;
    actualTime.textContent = `${formatDurationHoursMinutes(session.actual_time_seconds)} focused`;
    percentage.textContent = `${Math.floor(session.percentage_completed)}% completion`;

    container.append(targetTime, actualTime, percentage);
    return container;
}

/** Toggle a history session's action menu. */
export function toggleSessionMenu(event: MouseEvent): void {
    const toggleIcon = closestElement(event.target, '.dashboard-session-open-menu-icon', HTMLElement);
    if (!toggleIcon) return;
    const menu = getElement('.dashboard-session-menu', HTMLElement, getParentElement(toggleIcon));
    const wasOpen = menu.style.display === 'flex';
    const list = event.currentTarget;
    if (!(list instanceof Element)) return;
    getAllElements('.dashboard-session-menu', HTMLElement, list).forEach(/** Close other session menus before toggling the selected menu. */ (otherMenu) => {
        otherMenu.style.display = 'none';
    });
    menu.style.display = wasOpen ? 'none' : 'flex';
}

/** Close history menus when clicking outside their controls. */
export function closeSessionMenusOnOutsideClick(event: MouseEvent): void {
    if (closestElement(event.target, '.dashboard-session-menu, .dashboard-session-open-menu-icon', Element)) return;
    getAllElements('.dashboard-session-menu', HTMLElement).forEach(/** Close a history session menu. */ (menu) => {
        menu.style.display = 'none';
    });
}

/** Delete the selected history session, then call reload to refresh the Dashboard or Room data. The caller names its screen. */
export async function handleDeleteSession(event: MouseEvent, screen: ScreenName, reload: () => Promise<void>): Promise<void> {
    const deleteButton = closestElement(event.target, '.dashboard-delete-session-btn', HTMLButtonElement);
    if (!deleteButton || deleteButton.disabled) return;
    const sessionId = deleteButton.dataset.sessionId;
    if (sessionId === undefined) return;
    if (!confirm('Delete this session?')) return;
    const menu = requireClosest(deleteButton, '.dashboard-session-menu', HTMLElement);
    menu.querySelector('.form-error-message')?.remove();
    deleteButton.disabled = true;
    deleteButton.textContent = 'Deleting…';
    try {
        const result = await deleteSession(sessionId, screen);
        if (!result.success) throw new Error('Deletion failed');
        await reload();
    } catch (error) {
        const message = document.createElement('p');
        message.className = 'form-error-message';
        message.setAttribute('role', 'alert');
        message.textContent = 'Couldn’t delete this session. Try again.';
        menu.appendChild(message);
    } finally {
        deleteButton.disabled = false;
        deleteButton.textContent = 'Delete Session';
    }
}
