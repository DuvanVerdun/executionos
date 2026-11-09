// Calls to the backend streak route.

import { apiFetch } from '../auth/http.js';
import { getBrowserTimezone } from '../lib/dates.js';

/** Request streak and calendar data for a month. */
export function fetchStreak(anchorDate, currentScreen) {
    const params = new URLSearchParams({
        anchor_date: anchorDate,
        timezone: getBrowserTimezone()
    });

    return apiFetch({
        path: `streak?${params.toString()}`,
        method: 'GET',
        currentScreen
    });
}
