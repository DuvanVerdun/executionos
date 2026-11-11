import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeStreakState } from '../streak/streak';
import { fakeBackendByPath, requestedPaths, type FakeAnswer } from '../test/network';
import type { DashboardData } from '../types/dashboard';
import type { HistoryCursor, HistorySession } from '../types/session';
import { dashboardStore, loadDashboard, refreshDashboard, type DashboardSurface } from './dashboard';

/** Make a saved session with the given ID. */
function session(id: number): HistorySession {
    return {
        id, date: '2026-11-09T12:00:00', mission: `Mission ${id}`, target_time_seconds: 600,
        actual_time_seconds: 600, percentage_completed: 100, completion_status: 'completed'
    };
}

/** Make the summary and trend the server sends for a period with the given number of sessions. */
function summary(totalSessions: number): DashboardData & { success: true } {
    return {
        success: true,
        period: { type: 'week', anchor_date: '2026-11-09', start_date: '2026-11-09', end_date: '2026-11-15' },
        summary: { total_time_seconds: totalSessions * 600, total_sessions: totalSessions, average_completion_percentage: 100, average_session_time_seconds: 600 },
        trend: []
    };
}

/** Make a page of the history. */
function page(ids: number[], nextCursor: HistoryCursor | null, dailyTotal = ids.length): FakeAnswer {
    return {
        status: 200,
        body: {
            success: true,
            sessions: ids.map(session),
            daily_summaries: { '2026-11-09': { total_sessions: dailyTotal, total_time_seconds: dailyTotal * 600, average_completion_percentage: 100, average_session_time_seconds: 600 } },
            next_cursor: nextCursor
        }
    };
}

/** Say that the Dashboard shows these sessions, as if the user had scrolled down to load them. */
function showSessions(ids: number[], nextCursor: HistoryCursor | null): void {
    dashboardStore.update({
        surface: 'data',
        data: summary(ids.length),
        sessions: ids.map(session),
        nextCursor,
        anchorDates: { week: '2026-11-09', month: '', year: '', all_time: '' }
    });
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    initializeStreakState();
});

describe('refreshing the Dashboard after a delete', () => {
    it('removes the deleted session at once, before the server answers', async () => {
        fakeBackendByPath(/** Answer each request. */ (path) => (path.startsWith('dashboard') ? { status: 200, body: summary(2) } : path.startsWith('get-sessions') ? page([1, 3], null) : { status: 500 }));
        showSessions([1, 2, 3], null);
        const refreshing = refreshDashboard(2);
        expect(dashboardStore.get().sessions.map(/** Read the ID of a session. */ (item) => item.id)).toEqual([1, 3]);
        await refreshing;
    });

    it('never shows the loading screen', async () => {
        fakeBackendByPath(/** Answer each request. */ (path) => (path.startsWith('dashboard') ? { status: 200, body: summary(2) } : path.startsWith('get-sessions') ? page([1, 3], null) : { status: 500 }));
        showSessions([1, 2, 3], null);
        const seen: DashboardSurface[] = [];
        const stopListening = dashboardStore.subscribe(/** Record the surface after each change. */ () => { seen.push(dashboardStore.get().surface); });
        await refreshDashboard(2);
        stopListening();
        expect(seen).not.toContain('loading');
        expect(dashboardStore.get().surface).toBe('data');
    });

    it('updates the summary and the daily summaries from the server', async () => {
        fakeBackendByPath(/** Answer each request. */ (path) => (path.startsWith('dashboard') ? { status: 200, body: summary(2) } : path.startsWith('get-sessions') ? page([1, 3], null) : { status: 500 }));
        showSessions([1, 2, 3], null);
        await refreshDashboard(2);
        expect(dashboardStore.get().data?.summary.total_sessions).toBe(2);
        expect(dashboardStore.get().dailySummaries['2026-11-09']?.total_sessions).toBe(2);
    });

    it('loads more pages to keep the list as long as it was', async () => {
        const cursor1 = { date: '2026-11-09T11:00:00', id: 3 };
        const cursor2 = { date: '2026-11-09T10:00:00', id: 5 };
        const fake = fakeBackendByPath(/** Answer each request. */ (path) => {
            if (path.startsWith('dashboard')) return { status: 200, body: summary(5) };
            if (!path.startsWith('get-sessions')) return { status: 500 };
            if (path.includes('cursor_id=3')) return page([4, 5], cursor2);
            if (path.includes('cursor_id=5')) return page([6], null);
            return page([1, 3], cursor1);
        });
        showSessions([1, 2, 3, 4, 5, 6], cursor2);
        await refreshDashboard(2);
        expect(dashboardStore.get().sessions.map(/** Read the ID of a session. */ (item) => item.id)).toEqual([1, 3, 4, 5, 6]);
        expect(requestedPaths(fake).filter(/** Keep the history requests. */ (path) => path.startsWith('get-sessions'))).toHaveLength(3);
    });

    it('stops loading pages when no page is left', async () => {
        const fake = fakeBackendByPath(/** Answer each request. */ (path) => (path.startsWith('dashboard') ? { status: 200, body: summary(1) } : path.startsWith('get-sessions') ? page([1], null) : { status: 500 }));
        showSessions([1, 2, 3], null);
        await refreshDashboard(2);
        expect(requestedPaths(fake).filter(/** Keep the history requests. */ (path) => path.startsWith('get-sessions'))).toHaveLength(1);
    });

    it('shows the empty state when the deleted session was the last one of the period', async () => {
        fakeBackendByPath(/** Answer each request. */ (path) => (path.startsWith('dashboard') ? { status: 200, body: summary(0) } : path.startsWith('get-sessions') ? page([], null) : { status: 500 }));
        showSessions([1], null);
        await refreshDashboard(1);
        expect(dashboardStore.get().surface).toBe('empty');
    });

    it('also reloads the streak, which a delete can change', async () => {
        const fake = fakeBackendByPath(/** Answer each request. */ (path) => (path.startsWith('dashboard') ? { status: 200, body: summary(1) } : path.startsWith('get-sessions') ? page([1], null) : { status: 500 }));
        showSessions([1, 2], null);
        await refreshDashboard(2);
        expect(requestedPaths(fake).some(/** Find the streak request. */ (path) => path.startsWith('streak'))).toBe(true);
    });

    it('loads the whole Dashboard again when the refresh fails', async () => {
        let dashboardRequests = 0;
        const fake = fakeBackendByPath(/** Answer each request. */ (path) => {
            if (path.startsWith('dashboard')) {
                dashboardRequests += 1;
                return dashboardRequests === 1 ? { status: 500 } : { status: 200, body: summary(2) };
            }
            return path.startsWith('get-sessions') ? page([1, 3], null) : { status: 500 };
        });
        showSessions([1, 2, 3], null);
        await refreshDashboard(2);
        expect(dashboardRequests).toBe(2);
        expect(dashboardStore.get().surface).toBe('data');
        expect(requestedPaths(fake).length).toBeGreaterThan(3);
    });

    it('does not let a pagination request that was running add old sessions afterwards', async () => {
        fakeBackendByPath(/** Answer each request. */ (path) => (path.startsWith('dashboard') ? { status: 200, body: summary(2) } : path.startsWith('get-sessions') ? page([1, 3], null) : { status: 500 }));
        showSessions([1, 2, 3], null);
        dashboardStore.update({ isLoadingMore: true });
        await refreshDashboard(2);
        expect(dashboardStore.get().isLoadingMore).toBe(false);
    });
});

describe('loading the Dashboard', () => {
    it('shows the loading screen first, then the data', async () => {
        fakeBackendByPath(/** Answer each request. */ (path) => (path.startsWith('dashboard') ? { status: 200, body: summary(1) } : path.startsWith('get-sessions') ? page([1], null) : { status: 500 }));
        dashboardStore.update({ anchorDates: { week: '2026-11-09', month: '', year: '', all_time: '' } });
        const seen: DashboardSurface[] = [];
        const stopListening = dashboardStore.subscribe(/** Record the surface after each change. */ () => { seen.push(dashboardStore.get().surface); });
        await loadDashboard();
        stopListening();
        expect(seen).toContain('loading');
        expect(dashboardStore.get().surface).toBe('data');
    });
});
