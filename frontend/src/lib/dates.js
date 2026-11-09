// Pure helpers for dates, periods and server timestamps.

/** Return the browser's resolved time zone. */
export function getBrowserTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Format a local calendar date as YYYY-MM-DD. */
export function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD string as a local calendar date. */
export function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/** Normalize an anchor to the selected calendar period. */
export function normalizePeriodAnchor(period, anchorDate) {
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
export function shiftPeriodAnchor(period, anchorDate, direction) {
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
export function shiftMonthAnchor(anchorDate, direction) {
    const date = parseLocalDate(anchorDate);
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
    return formatLocalDate(date);
}

/** Convert a session timestamp to a local Date. */
function getSessionLocalDate(session) {
    return new Date(`${session.date}Z`);
}

/** Return a session's local calendar date key. */
export function getSessionLocalDateKey(session) {
    return formatLocalDate(getSessionLocalDate(session));
}

/** Format a session date for a history card heading. */
export function formatSessionDateLabel(session) {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    }).format(getSessionLocalDate(session));
}

/** Format a calendar date for period navigation. */
export function formatPeriodDate(dateString) {
    if (!dateString) return '';

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
    }).format(parseLocalDate(dateString));
}

/** Format a trend bucket label for the selected period. */
export function formatTrendBucketLabel(bucketStart, period) {
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
export function groupSessionsByLocalDate(sessions) {
    const groups = new Map();
    for (const session of sessions) {
        const dateKey = getSessionLocalDateKey(session);
        if (!groups.has(dateKey)) {
            groups.set(dateKey, []);
        }
        groups.get(dateKey).push(session);
    }
    return groups;
}

/** Parse a server timestamp, which is UTC without a Z. */
export function parseServerTime(value) {
    return Date.parse(`${value}Z`);
}
