// Send sessions queued in this browser to the server.

import { authState } from '../auth/state.js';
import { loadDashboard } from '../dashboard/dashboard.js';
import { dashboardDom } from '../dashboard/dom.js';
import { setFloatingMessage } from '../shared/floating-message.js';
import { loadStreak } from '../streak/calendar.js';
import { postSession } from './api.js';
import { sessionRuntime } from './state.js';
import { sessionQueue } from './storage.js';

let isSyncingSessions = false;

/** Retry the signed-in account's queued submissions and refresh displayed totals. */
export async function syncOfflineWork() {
    if (!authState.accessToken || isSyncingSessions || sessionRuntime.isFinishing) return;
    const userId = authState.userId;
    isSyncingSessions = true;
    let synced = 0;
    let queueLoaded = false;
    try {
        const items = sessionQueue.load(userId);
        queueLoaded = true;
        if (!items.length) return;
        for (const item of items) {
            if (authState.userId !== userId) return;
            await postSession(item, userId);
            if (authState.userId !== userId) return;
            await sessionQueue.remove(userId, item.submissionId);
            synced += 1;
        }
        setFloatingMessage('Your saved sessions are synced. Nice work.', { saved: true });
    } catch (error) {
        console.error('Session sync failed:', error);
        if (authState.userId !== userId) return;
        const needsSignIn = error.status === 401 || error.status === 403;
        let message = 'Sessions saved on this browser are waiting to sync. Dashboard totals update after syncing.';
        if (!queueLoaded) message = 'Couldn’t read browser saves. Please reload to try again.';
        else if (needsSignIn) message = 'Sessions are saved on this browser. Sign in again to sync them.';
        else if (error.status === 400 || error.status === 409) {
            message = 'A saved session needs attention before it can sync. It is still on this browser.';
        }
        setFloatingMessage(message);
    } finally {
        isSyncingSessions = false;
        if (synced && authState.userId === userId) {
            if (dashboardDom.screen.style.display !== 'none' && dashboardDom.screen.style.display) {
                await loadDashboard();
            } else {
                await loadStreak('plan');
            }
        }
    }
}

/** Retry queued sessions when the browser comes back online. */
export function initSync() {
    window.addEventListener('online', /** Retry queued submissions when connectivity returns. */ () => { void syncOfflineWork(); });
}
