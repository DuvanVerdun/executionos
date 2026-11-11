import { t } from '../i18n/i18n';
import { formatLocalDate, normalizePeriodAnchor, parseLocalDate, shiftPeriodAnchor } from '../lib/dates';
import { createStore } from '../lib/store';
import { waitForMinimumFeedback } from '../lib/timing';
import { navigateTo } from '../shared/navigation';
import { loadStreak } from '../streak/streak';
import type { ApiSuccess } from '../types/api';
import type { DashboardData, DashboardMetric, DashboardPeriod } from '../types/dashboard';
import type { DailySummary, HistoryCursor, HistorySession } from '../types/session';
import { fetchDashboardData, fetchSessionsPage } from './api';

/** What the Dashboard shows below the period controls. */
export type DashboardSurface = 'loading' | 'data' | 'empty' | 'error';

/** The dates of the selected period. An all-time period has no start date. */
export interface PeriodRange {
    start_date: string | null;
    end_date: string;
}

interface DashboardState {
    period: DashboardPeriod;
    /** The first day of the selected period, for each period. */
    anchorDates: Record<DashboardPeriod, string>;
    metric: DashboardMetric;
    /** The dates the controls show: the selection first, then what the server answered. */
    periodRange: PeriodRange;
    surface: DashboardSurface;
    data: DashboardData | null;
    sessions: HistorySession[];
    dailySummaries: Record<string, DailySummary>;
    nextCursor: HistoryCursor | null;
    isLoading: boolean;
    isLoadingMore: boolean;
    paginationFailed: boolean;
    paginationMessage: string;
}

export const dashboardStore = createStore<DashboardState>({
    period: 'week',
    anchorDates: { week: '', month: '', year: '', all_time: '' },
    metric: 'time',
    periodRange: { start_date: null, end_date: '' },
    surface: 'data',
    data: null,
    sessions: [],
    dailySummaries: {},
    nextCursor: null,
    isLoading: false,
    isLoadingMore: false,
    paginationFailed: false,
    paginationMessage: ''
});

/** Grows with every load and every screen exit, so older results can be ignored. */
let loadGeneration = 0;

/** Initialize the selected period's date while preserving previous selections. */
export function initializeDashboardState(): void {
    const { period, anchorDates } = dashboardStore.get();
    if (period === 'all_time' || !anchorDates[period]) {
        dashboardStore.update({
            anchorDates: { ...anchorDates, [period]: normalizePeriodAnchor(period, formatLocalDate(new Date())) }
        });
    }
}

/** Return the dates of the selected period, before the server answers. */
function getSelectedPeriodRange(): PeriodRange {
    const { period, anchorDates } = dashboardStore.get();
    if (period === 'all_time') return { start_date: null, end_date: '' };
    const start = normalizePeriodAnchor(period, anchorDates[period]);
    const end = parseLocalDate(start);
    if (period === 'week') end.setDate(end.getDate() + 6);
    else if (period === 'month') end.setMonth(end.getMonth() + 1, 0);
    else end.setMonth(11, 31);
    return { start_date: start, end_date: formatLocalDate(end) };
}

/** Fetch and append the next session page for the current period. */
export async function loadMoreSessions(): Promise<void> {
    const state = dashboardStore.get();
    if (state.isLoading || state.paginationFailed || state.isLoadingMore || !state.nextCursor) return;
    const generation = loadGeneration;
    dashboardStore.update({ isLoadingMore: true, paginationMessage: t('common.loadingMore') });
    try {
        const result = await fetchSessionsPage(state.period, state.anchorDates[state.period], state.nextCursor);
        if (generation !== loadGeneration) return;
        if (!result.success) {
            throw new Error(result.error);
        }
        const current = dashboardStore.get();
        dashboardStore.update({
            sessions: [...current.sessions, ...result.sessions],
            dailySummaries: { ...current.dailySummaries, ...result.daily_summaries },
            nextCursor: result.next_cursor,
            paginationMessage: ''
        });
    } catch (error) {
        if (generation !== loadGeneration) return;
        console.error('Session pagination error:', error);
        dashboardStore.update({ paginationFailed: true, paginationMessage: t('common.moreSessionsFailed') });
    } finally {
        if (generation === loadGeneration) {
            dashboardStore.update({ isLoadingMore: false });
        }
    }
}

/** Show a new mission on a session of the list. The server has already saved it, and no total depends on it. */
export function setSessionMission(sessionId: number, mission: string): void {
    dashboardStore.update({
        sessions: dashboardStore.get().sessions.map(/** Change the mission of the matching session. */ (session) => (
            session.id === sessionId ? { ...session, mission } : session
        ))
    });
}

/** The sessions on screen, their daily summaries, and where the next page starts. */
type SessionList = Pick<DashboardState, 'sessions' | 'dailySummaries' | 'nextCursor'>;

/** Show loaded Dashboard data: the summary and trend, the sessions, and the position of the next page. */
function showDashboard(dashboardResult: ApiSuccess<DashboardData>, list: SessionList): void {
    const { period, anchorDates } = dashboardStore.get();
    const nextAnchorDates = period !== 'all_time' && dashboardResult.period.start_date
        ? { ...anchorDates, [period]: dashboardResult.period.start_date }
        : anchorDates;
    dashboardStore.update({
        data: dashboardResult,
        ...list,
        anchorDates: nextAnchorDates,
        isLoading: false,
        periodRange: { start_date: dashboardResult.period.start_date, end_date: dashboardResult.period.end_date },
        surface: dashboardResult.summary.total_sessions === 0 ? 'empty' : 'data'
    });
}

/** Load period data and sessions while ignoring superseded results. */
export async function loadDashboard(feedbackStartedAt: number | null = null): Promise<void> {
    const generation = ++loadGeneration;
    const { period, anchorDates } = dashboardStore.get();
    const anchorDate = anchorDates[period];
    dashboardStore.update({
        isLoading: true,
        isLoadingMore: false,
        paginationFailed: false,
        paginationMessage: '',
        periodRange: getSelectedPeriodRange()
    });
    if (feedbackStartedAt === null) dashboardStore.update({ surface: 'loading' });

    try {
        const [dashboardResult, sessionsResult] = await Promise.all([
            fetchDashboardData(period, anchorDate),
            fetchSessionsPage(period, anchorDate)
        ]);
        if (feedbackStartedAt !== null) await waitForMinimumFeedback(feedbackStartedAt);
        if (generation !== loadGeneration) return;
        if (!dashboardResult.success) {
            throw new Error(dashboardResult.error);
        }
        if (!sessionsResult.success) {
            throw new Error(sessionsResult.error);
        }
        showDashboard(dashboardResult, {
            sessions: sessionsResult.sessions,
            dailySummaries: sessionsResult.daily_summaries,
            nextCursor: sessionsResult.next_cursor
        });

        await loadStreak('dashboard');

    } catch (error) {
        if (feedbackStartedAt !== null) await waitForMinimumFeedback(feedbackStartedAt);
        if (generation !== loadGeneration) return;
        console.error(
            'Dashboard loading error:',
            error
        );
        dashboardStore.update({ surface: 'error' });

    } finally {
        if (generation === loadGeneration) {
            dashboardStore.update({ isLoading: false });
        }
    }
}

/** Fetch session pages from the first one until there are at least this many sessions, or no page is left. */
async function fetchSessionsAtLeast(period: DashboardPeriod, anchorDate: string, minimumCount: number): Promise<SessionList> {
    let list: SessionList = { sessions: [], dailySummaries: {}, nextCursor: null };
    do {
        const page = await fetchSessionsPage(period, anchorDate, list.nextCursor);
        if (!page.success) throw new Error(page.error);
        list = {
            sessions: [...list.sessions, ...page.sessions],
            dailySummaries: { ...list.dailySummaries, ...page.daily_summaries },
            nextCursor: page.next_cursor
        };
    } while (list.nextCursor !== null && list.sessions.length < minimumCount);
    return list;
}

/**
 * Update the Dashboard after a session was deleted, without a loading screen.
 * The session leaves the list at once. The summary, the trend and the daily summaries then refresh in place,
 * and the list keeps the length it had. If the refresh fails, the whole Dashboard loads again.
 */
export async function refreshDashboard(deletedSessionId: number): Promise<void> {
    const generation = ++loadGeneration;
    const { period, anchorDates, sessions } = dashboardStore.get();
    const anchorDate = anchorDates[period];
    const remaining = sessions.filter(/** Keep every session except the deleted one. */ (session) => session.id !== deletedSessionId);
    dashboardStore.update({
        sessions: remaining,
        isLoading: true,
        isLoadingMore: false,
        paginationFailed: false,
        paginationMessage: ''
    });

    try {
        const [dashboardResult, list] = await Promise.all([
            fetchDashboardData(period, anchorDate),
            fetchSessionsAtLeast(period, anchorDate, remaining.length)
        ]);
        if (generation !== loadGeneration) return;
        if (!dashboardResult.success) throw new Error(dashboardResult.error);
        showDashboard(dashboardResult, list);
        await loadStreak('dashboard');
    } catch (error) {
        if (generation !== loadGeneration) return;
        console.error('Dashboard refresh error:', error);
        await loadDashboard();
    } finally {
        if (generation === loadGeneration) {
            dashboardStore.update({ isLoading: false });
        }
    }
}

/** Retry the failed history page request. */
export function retryPagination(): void {
    const state = dashboardStore.get();
    if (state.isLoading || state.isLoadingMore) return;
    dashboardStore.update({ paginationFailed: false });
    void loadMoreSessions();
}

/** Return from Dashboard to mission planning. */
export function handleDashboardToPlan(): void {
    navigateTo('plan', 'dashboard');
}

/** Select a Dashboard period and reload its data. */
export async function changeDashboardPeriod(newPeriod: DashboardPeriod): Promise<void> {
    dashboardStore.update({ period: newPeriod });
    initializeDashboardState();
    await loadDashboard();
}

/** Move to the adjacent Dashboard period and reload its data. */
export async function moveDashboardPeriod(direction: number): Promise<void> {
    const { period, anchorDates } = dashboardStore.get();
    if (period === 'all_time') return;
    dashboardStore.update({
        anchorDates: { ...anchorDates, [period]: shiftPeriodAnchor(period, anchorDates[period], direction) }
    });
    await loadDashboard();
}

/** Select a trend metric. */
export function changeDashboardMetric(newMetric: DashboardMetric): void {
    dashboardStore.update({ metric: newMetric });
}

/** Stop Dashboard loading and pagination when the user leaves the Dashboard. */
export function leaveDashboardScreen(): void {
    loadGeneration += 1;
    dashboardStore.update({ isLoading: false, isLoadingMore: false });
}
