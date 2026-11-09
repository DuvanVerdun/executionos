// Send sessions queued in this browser to the server.

import { authState } from '../auth/state';
import { loadDashboard } from '../dashboard/dashboard';
import { dashboardDom } from '../dashboard/dom';
import { setFloatingMessage } from '../shared/floating-message';
import { errorStatus } from '../lib/errors';
import { loadStreak } from '../streak/calendar';
import { postSession } from './api';
import { sessionRuntime } from './state';
import { sessionQueue } from './storage';

let isSyncingSessions = false;

/** Retry the signed-in account's queued submissions and refresh displayed totals. */
export async function syncOfflineWork(): Promise<void> {
    if (!authState.accessToken || isSyncingSessions || sessionRuntime.isFinishing) return;
    const userId = authState.userId;
    if (userId === null) return;
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
        const status = errorStatus(error);
        const needsSignIn = status === 401 || status === 403;
        let message = 'Sessions saved on this browser are waiting to sync. Dashboard totals update after syncing.';
        if (!queueLoaded) message = 'Couldn’t read browser saves. Please reload to try again.';
        else if (needsSignIn) message = 'Sessions are saved on this browser. Sign in again to sync them.';
        else if (status === 400 || status === 409) {
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
export function initSync(): void {
    window.addEventListener('online', /** Retry queued submissions when connectivity returns. */ () => { void syncOfflineWork(); });
}
