// Pure helpers for dates, periods and server timestamps.

import type { DashboardPeriod } from '../types/dashboard';

/** Return the browser's resolved time zone. */
export function getBrowserTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Format a local calendar date as YYYY-MM-DD. */
export function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD string as a local calendar date. */
export function parseLocalDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year ?? NaN, (month ?? NaN) - 1, day ?? NaN);
}

/** Normalize an anchor to the selected calendar period. */
export function normalizePeriodAnchor(period: DashboardPeriod, anchorDate: string): string {
    const date = parseLocalDate(anchorDate);
    if (period === 'week') {
        const daysSinceMonday = (date.getDay() + 6) % 7;
        date.setDate(date.getDate() - daysSinceMonday);
    } else if (period === 'month') {
        date.setDate(1);
    } else if (period === 'year') {
        date.setMonth(0, 1);
    }
    return formatLocalDate(date);
}

/** Move an anchor backward or forward by one period. */
export function shiftPeriodAnchor(period: DashboardPeriod, anchorDate: string, direction: number): string {
    const date = parseLocalDate(
        normalizePeriodAnchor(period, anchorDate)
    );

    if (period === 'week') {
        date.setDate(date.getDate() + 7 * direction);
    } else if (period === 'month') {
        date.setMonth(date.getMonth() + direction);
    } else if (period === 'year') {
        date.setFullYear(date.getFullYear() + direction);
    }

    return formatLocalDate(date);
}

/** Move an anchor backward or forward by one calendar month. */
export function shiftMonthAnchor(anchorDate: string, direction: number): string {
    const date = parseLocalDate(anchorDate);
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
    return formatLocalDate(date);
}

/** Convert a session timestamp to a local Date. */
function getSessionLocalDate(session: { date: string }): Date {
    return new Date(`${session.date}Z`);
}

/** Return a session's local calendar date key. */
export function getSessionLocalDateKey(session: { date: string }): string {
    return formatLocalDate(getSessionLocalDate(session));
}

/** Format a session date for a history card heading. */
export function formatSessionDateLabel(session: { date: string }): string {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    }).format(getSessionLocalDate(session));
}

/** Format a calendar date for period navigation. */
export function formatPeriodDate(dateString: string | null): string {
    if (!dateString) return '';

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
    }).format(parseLocalDate(dateString));
}

/** Format a trend bucket label for the selected period. */
export function formatTrendBucketLabel(bucketStart: string, period: DashboardPeriod): string {
    const date = parseLocalDate(bucketStart);

    if (period === 'week') {
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'short'
        }).format(date);
    }

    if (period === 'month') {
        return String(date.getDate());
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short'
    }).format(date);
}

/** Group sessions by local calendar date. */
export function groupSessionsByLocalDate<S extends { date: string }>(sessions: S[]): Map<string, S[]> {
    const groups = new Map<string, S[]>();
    for (const session of sessions) {
        const dateKey = getSessionLocalDateKey(session);
        const group = groups.get(dateKey);
        if (group) {
            group.push(session);
        } else {
            groups.set(dateKey, [session]);
        }
    }
    return groups;
}

/** Parse a server timestamp, which is UTC without a Z. */
export function parseServerTime(value: string): number {
    return Date.parse(`${value}Z`);
}
