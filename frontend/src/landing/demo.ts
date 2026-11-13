import { at } from '../lib/arrays';
import { addDays, formatLocalDate, getDaysInMonth } from '../lib/dates';
import type { CalendarDay, TrendBucket } from '../types/dashboard';
import type { RankingEntry } from '../types/rooms';

/** What a past day holds in the demo. */
export type DemoPastState = 'work' | 'rest' | 'missed';

/** Whether a day of a month is behind, today, or ahead. */
export type MonthDayKind = 'past' | 'today' | 'future';

export interface MonthDay {
    day: number;
    kind: MonthDayKind;
}

export interface DemoStats {
    totalTimeSeconds: number;
    totalSessions: number;
    averageCompletionPercentage: number;
    averageSessionSeconds: number;
}

const DAYS_IN_WEEK = 7;
const REST_DAYS_PER_WEEK = 2;
const NO_WORK_WEEKDAYS_BY_WEEK: readonly (readonly number[])[] = [[], [5, 6], [1, 4, 6], [6]];
const FOCUS_WOBBLE_MINUTES = [0, -6, 4, -9, 7, -3, 5] as const;
const WINDOW_START_FOCUS_MINUTES = 62;
const MIN_FOCUS_MINUTES = 45;
const MAX_FOCUS_MINUTES = 120;
const MINUTES_PER_SESSION = 45;
const TREND_DAYS = 30;
const STREAK_SEARCH_DAYS = 120;
const AVERAGE_COMPLETION_PERCENTAGE = 92;

/** The days worked, ever, in the demo. */
export const DEMO_TOTAL_WORKED_DAYS = 34;

/** The people in the demo room, as the room ranking draws them. */
export const DEMO_RANKING: readonly RankingEntry[] = [
    { position: 1, username: 'ana', is_you: false, is_owner: true, state: 'working', ring_percentage: 70, total_time_seconds: 30000, sessions_count: 12 },
    { position: 2, username: 'you', is_you: true, is_owner: false, state: 'working', ring_percentage: 45, total_time_seconds: 21900, sessions_count: 9 },
    { position: 3, username: 'leo', is_you: false, is_owner: false, state: 'working', ring_percentage: 85, total_time_seconds: 16800, sessions_count: 7 },
    { position: 4, username: 'mia', is_you: false, is_owner: false, state: 'paused', ring_percentage: null, total_time_seconds: 11700, sessions_count: 5 },
    { position: 5, username: 'sam', is_you: false, is_owner: false, state: 'not_working', ring_percentage: null, total_time_seconds: 3900, sessions_count: 2 }
];

/** Return the weekday of today, counting Monday as 0. */
function getWeekdayIndex(date: Date): number {
    return (date.getDay() + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK;
}

/**
 * Return what a past day holds, like the app decides it: a week (Monday to Sunday) has two rest days,
 * and the third day without work is a missed day, which breaks the streak.
 * Which weekdays have no work depends on how many weeks ago the week was, so every week looks the same on every real day.
 */
export function demoPastState(today: Date, daysAgo: number): DemoPastState {
    const todayWeekday = getWeekdayIndex(today);
    const weeksAgo = daysAgo <= todayWeekday ? 0 : Math.ceil((daysAgo - todayWeekday) / DAYS_IN_WEEK);
    const weekday = (((todayWeekday - daysAgo) % DAYS_IN_WEEK) + DAYS_IN_WEEK) % DAYS_IN_WEEK;
    const noWorkWeekdays = at(NO_WORK_WEEKDAYS_BY_WEEK, weeksAgo % NO_WORK_WEEKDAYS_BY_WEEK.length);
    const noWorkOrder = noWorkWeekdays.indexOf(weekday);
    if (noWorkOrder === -1) return 'work';
    return noWorkOrder < REST_DAYS_PER_WEEK ? 'rest' : 'missed';
}

/** Return the minutes focused on a day. Recent days are longer, so the chart climbs and reaches 2 hours. */
export function demoFocusMinutes(daysAgo: number): number {
    const climbing = WINDOW_START_FOCUS_MINUTES + (TREND_DAYS - 1 - daysAgo) * 2 + at(FOCUS_WOBBLE_MINUTES, daysAgo % FOCUS_WOBBLE_MINUTES.length);
    return Math.min(MAX_FOCUS_MINUTES, Math.max(MIN_FOCUS_MINUTES, Math.round(climbing / 5) * 5));
}

/** Return the sessions of a day. */
export function demoSessions(daysAgo: number): number {
    return Math.max(1, Math.round(demoFocusMinutes(daysAgo) / MINUTES_PER_SESSION));
}

/** Return the current streak of the demo: the days worked in a row, where rest days do not break it. */
export function demoCurrentStreak(today: Date): number {
    let streak = 0;
    for (let daysAgo = 1; daysAgo <= STREAK_SEARCH_DAYS; daysAgo++) {
        const state = demoPastState(today, daysAgo);
        if (state === 'missed') return streak;
        if (state === 'work') streak++;
    }
    return streak;
}

/** Return the rest days that this week still has: two, less the ones already taken. */
export function demoRestDaysRemaining(today: Date): number {
    let taken = 0;
    for (let daysAgo = 1; daysAgo <= getWeekdayIndex(today); daysAgo++) {
        if (demoPastState(today, daysAgo) === 'rest') taken++;
    }
    return REST_DAYS_PER_WEEK - taken;
}

/** Return the demo day that falls a number of days before today. Negative numbers are days ahead. */
export function demoDay(today: Date, daysAgo: number): CalendarDay {
    const date = formatLocalDate(addDays(today, -daysAgo));
    if (daysAgo < 0) return { date, state: 'neutral', total_sessions: 0, total_time_seconds: 0 };
    if (daysAgo === 0) return { date, state: 'today', total_sessions: 0, total_time_seconds: 0 };
    const state = demoPastState(today, daysAgo);
    if (state !== 'work') return { date, state, total_sessions: 0, total_time_seconds: 0 };
    return { date, state, total_sessions: demoSessions(daysAgo), total_time_seconds: demoFocusMinutes(daysAgo) * 60 };
}

/** Return the last days up to today, oldest first. */
export function demoRecentDays(today: Date, count: number): CalendarDay[] {
    return Array.from({ length: count }, /** Build one day, counting back from today. */ (_, index) => demoDay(today, count - 1 - index));
}

/** Return every day of the month of today. */
export function demoMonthDays(today: Date): CalendarDay[] {
    return Array.from({ length: getDaysInMonth(today) }, /** Build one day of the month. */ (_, index) => demoDay(today, today.getDate() - (index + 1)));
}

/** Return every day of the month of today, marked as behind, today, or ahead. */
export function getMonthDays(today: Date): MonthDay[] {
    return Array.from({ length: getDaysInMonth(today) }, /** Mark one day of the month. */ (_, index) => {
        const day = index + 1;
        return { day, kind: day < today.getDate() ? 'past' : day === today.getDate() ? 'today' : 'future' };
    });
}

/** Return how many days are left in the month of today, not counting today. */
export function getDaysLeftInMonth(today: Date): number {
    return getDaysInMonth(today) - today.getDate();
}

/** Return the trend of the last 30 days, ending today, for the chart. */
export function demoTrend(today: Date): TrendBucket[] {
    return Array.from({ length: TREND_DAYS }, /** Build one day of the trend, oldest first. */ (_, index) => {
        const daysAgo = TREND_DAYS - 1 - index;
        return {
            bucket_start: formatLocalDate(addDays(today, -daysAgo)),
            total_time_seconds: demoFocusMinutes(daysAgo) * 60,
            total_sessions: demoSessions(daysAgo),
            average_completion_percentage: AVERAGE_COMPLETION_PERCENTAGE,
            is_rest_day: false
        };
    });
}

/** Return the stats of the trend: what the four stats cards show. */
export function demoStats(): DemoStats {
    let totalTimeSeconds = 0;
    let totalSessions = 0;
    for (let daysAgo = 0; daysAgo < TREND_DAYS; daysAgo++) {
        totalTimeSeconds += demoFocusMinutes(daysAgo) * 60;
        totalSessions += demoSessions(daysAgo);
    }
    return {
        totalTimeSeconds,
        totalSessions,
        averageCompletionPercentage: AVERAGE_COMPLETION_PERCENTAGE,
        averageSessionSeconds: Math.round(totalTimeSeconds / totalSessions)
    };
}
