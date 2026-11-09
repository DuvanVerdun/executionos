import { apiFetch } from '../auth/http';
import { getBrowserTimezone } from '../lib/dates';
import type { ApiResult } from '../types/api';
import type { DashboardData, DashboardPeriod } from '../types/dashboard';
import type { ScreenName } from '../types/screens';
import type { HistoryCursor, HistoryPage } from '../types/session';

/** Request summary and trend data for the selected period. */
export function fetchDashboardData(period: DashboardPeriod, anchorDate: string, currentScreen: ScreenName = 'dashboard'): Promise<ApiResult<DashboardData>> {
    const params = new URLSearchParams({
        period,
        anchor_date: anchorDate,
        timezone: getBrowserTimezone()
    });

    return apiFetch<ApiResult<DashboardData>>({
        path: `dashboard?${params.toString()}`,
        method: 'GET',
        currentScreen
    });
}

/** Request a filtered page of sessions and daily summaries. */
export function fetchSessionsPage(
    period: DashboardPeriod,
    anchorDate: string,
    cursor: HistoryCursor | null = null,
    currentScreen: ScreenName = 'dashboard'
): Promise<ApiResult<HistoryPage>> {
    const params = new URLSearchParams({
        period,
        anchor_date: anchorDate,
        timezone: getBrowserTimezone()
    });

    if (cursor) {
        params.set('cursor_date', cursor.date);
        params.set('cursor_id', String(cursor.id));
    }

    return apiFetch<ApiResult<HistoryPage>>({
        path: `get-sessions?${params.toString()}`,
        method: 'GET',
        currentScreen
    });
}
