import { authStore } from '../auth/state';
import { loadDashboard } from '../dashboard/dashboard';
import { t } from '../i18n/i18n';
import { errorStatus } from '../lib/errors';
import { setFloatingMessage } from '../shared/floating-message';
import { getCurrentScreenName } from '../shared/navigation';
import { loadStreak } from '../streak/streak';
import { postSession } from './api';
import { sessionStore } from './state';
import { sessionQueue } from './storage';

let isSyncingSessions = false;

/** Retry the signed-in account's queued submissions and refresh displayed totals. */
export async function syncOfflineWork(): Promise<void> {
    if (!authStore.get().accessToken || isSyncingSessions || sessionStore.get().isFinishing) return;
    const userId = authStore.get().userId;
    if (userId === null) return;
    isSyncingSessions = true;
    let synced = 0;
    let queueLoaded = false;
    try {
        const items = sessionQueue.load(userId);
        queueLoaded = true;
        if (!items.length) return;
        for (const item of items) {
            if (authStore.get().userId !== userId) return;
            await postSession(item, userId);
            if (authStore.get().userId !== userId) return;
            await sessionQueue.remove(userId, item.submissionId);
            synced += 1;
        }
        setFloatingMessage(t('sync.done'), { saved: true });
    } catch (error) {
        console.error('Session sync failed:', error);
        if (authStore.get().userId !== userId) return;
        const status = errorStatus(error);
        const needsSignIn = status === 401 || status === 403;
        let message = t('sync.waiting');
        if (!queueLoaded) message = t('sync.unreadable');
        else if (needsSignIn) message = t('sync.signIn');
        else if (status === 400 || status === 409) {
            message = t('sync.needsAttention');
        }
        setFloatingMessage(message);
    } finally {
        isSyncingSessions = false;
        if (synced && authStore.get().userId === userId) {
            if (getCurrentScreenName() === 'dashboard') {
                await loadDashboard();
            } else {
                await loadStreak('plan');
            }
        }
    }
}
