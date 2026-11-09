// Calls to the backend streak route.

import { apiFetch } from '../auth/http';
import { getBrowserTimezone } from '../lib/dates';
import type { ApiResult } from '../types/api';
import type { StreakData } from '../types/dashboard';
import type { ScreenName } from '../types/screens';

/** Request streak and calendar data for a month. */
export function fetchStreak(anchorDate: string, currentScreen: ScreenName): Promise<ApiResult<StreakData>> {
    const params = new URLSearchParams({
        anchor_date: anchorDate,
        timezone: getBrowserTimezone()
    });

    return apiFetch<ApiResult<StreakData>>({
        path: `streak?${params.toString()}`,
        method: 'GET',
        currentScreen
    });
}
