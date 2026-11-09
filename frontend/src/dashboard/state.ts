// Dashboard state.

import type { DashboardData, DashboardMetric, DashboardPeriod } from '../types/dashboard';
import type { DailySummary, HistoryCursor, HistorySession } from '../types/session';

interface DashboardState {
    period: DashboardPeriod;
    /** The first day of the selected period, for each period. */
    anchorDates: Record<DashboardPeriod, string>;
    metric: DashboardMetric;
    data: DashboardData | null;
    sessions: HistorySession[];
    dailySummaries: Record<string, DailySummary>;
    nextCursor: HistoryCursor | null;
    isLoadingMore: boolean;
    paginationFailed: boolean;
    isLoading: boolean;
    /** Grows with every load, so older results can be ignored. */
    loadGeneration: number;
    sessionObserver: IntersectionObserver | null;
}

export const dashboardState: DashboardState = {
    period: 'week',
    anchorDates: { week: '', month: '', year: '', all_time: '' },
    metric: 'time',
    data: null,
    sessions: [],
    dailySummaries: {},
    nextCursor: null,
    isLoadingMore: false,
    paginationFailed: false,
    isLoading: false,
    loadGeneration: 0,
    sessionObserver: null
};
