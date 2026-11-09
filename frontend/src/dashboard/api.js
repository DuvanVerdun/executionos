// Calls to the backend dashboard routes.

import { apiFetch } from '../auth/http.js';
import { getBrowserTimezone } from '../lib/dates.js';

/** Request summary and trend data for the selected period. */
export function fetchDashboardData(period, anchorDate, currentScreen = 'dashboard') {
    const params = new URLSearchParams({
        period,
        anchor_date: anchorDate,
        timezone: getBrowserTimezone()
    });

    return apiFetch({
        path: `dashboard?${params.toString()}`,
        method: 'GET',
        currentScreen
    });
}

/** Request a filtered page of sessions and daily summaries. */
export function fetchSessionsPage(
    period,
    anchorDate,
    cursor = null,
    currentScreen = 'dashboard'
) {
    const params = new URLSearchParams({
        period,
        anchor_date: anchorDate,
        timezone: getBrowserTimezone()
    });

    if (cursor) {
        params.set('cursor_date', cursor.date);
        params.set('cursor_id', String(cursor.id));
    }

    return apiFetch({
        path: `get-sessions?${params.toString()}`,
        method: 'GET',
        currentScreen
    });
}
