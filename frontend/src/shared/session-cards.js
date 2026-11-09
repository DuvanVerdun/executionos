// Parts shared by the Dashboard and Room session history cards.

import { formatDurationHoursMinutes } from '../lib/durations.js';
import { deleteSession } from '../session/api.js';

/** Create a session's target, focused time, and completion metrics. */
export function createSessionTimeSection(session) {
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
export function toggleSessionMenu(event) {
    const toggleIcon = event.target.closest('.dashboard-session-open-menu-icon');
    if (!toggleIcon) return;
    const menu = toggleIcon.parentElement.querySelector('.dashboard-session-menu');
    const wasOpen = menu.style.display === 'flex';
    event.currentTarget.querySelectorAll('.dashboard-session-menu').forEach(/** Close other session menus before toggling the selected menu. */ (otherMenu) => {
        otherMenu.style.display = 'none';
    });
    menu.style.display = wasOpen ? 'none' : 'flex';
}

/** Close history menus when clicking outside their controls. */
export function closeSessionMenusOnOutsideClick(event) {
    if (event.target.closest('.dashboard-session-menu, .dashboard-session-open-menu-icon')) return;
    document.querySelectorAll('.dashboard-session-menu').forEach(/** Close a history session menu. */ (menu) => {
        menu.style.display = 'none';
    });
}

/** Delete the selected history session, then call reload to refresh the Dashboard or Room data. The caller names its screen. */
export async function handleDeleteSession(event, screen, reload) {
    const deleteButton = event.target.closest('.dashboard-delete-session-btn');
    if (!deleteButton || deleteButton.disabled) return;
    if (!confirm('Delete this session?')) return;
    const menu = deleteButton.closest('.dashboard-session-menu');
    menu.querySelector('.form-error-message')?.remove();
    deleteButton.disabled = true;
    deleteButton.textContent = 'Deleting…';
    try {
        const result = await deleteSession(deleteButton.dataset.sessionId, screen);
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
