import { describe, expect, it } from 'vitest';
import { at } from '../lib/arrays';
import { addDays, formatLocalDate } from '../lib/dates';
import {
    DEMO_RANKING,
    demoCurrentStreak,
    demoDay,
    demoFocusMinutes,
    demoMonthDays,
    demoPastState,
    demoRecentDays,
    demoRestDaysRemaining,
    demoSessions,
    demoStats,
    demoTrend,
    getDaysLeftInMonth,
    getMonthDays
} from './demo';

const NOVEMBER_12 = new Date(2026, 10, 12);

describe('a day of the demo', () => {
    it('holds the same thing on every real day: only the date changes', () => {
        const first = demoDay(NOVEMBER_12, 1);
        const later = demoDay(new Date(2027, 2, 3), 1);
        expect(later).toMatchObject({ state: first.state, total_sessions: first.total_sessions, total_time_seconds: first.total_time_seconds });
        expect(first.date).toBe('2026-11-11');
        expect(later.date).toBe('2027-03-02');
    });

    it('gives yesterday two sessions and 1h 50m', () => {
        expect(demoDay(NOVEMBER_12, 1)).toEqual({ date: '2026-11-11', state: 'work', total_sessions: 2, total_time_seconds: 110 * 60 });
    });

    it('gives the day before yesterday three sessions and 2h', () => {
        expect(demoDay(NOVEMBER_12, 2)).toEqual({ date: '2026-11-10', state: 'work', total_sessions: 3, total_time_seconds: 120 * 60 });
    });

    it('is today, with nothing yet, for zero days ago', () => {
        expect(demoDay(NOVEMBER_12, 0)).toEqual({ date: '2026-11-12', state: 'today', total_sessions: 0, total_time_seconds: 0 });
    });

    it('is neutral, with nothing, for a day ahead', () => {
        expect(demoDay(NOVEMBER_12, -3)).toEqual({ date: '2026-11-15', state: 'neutral', total_sessions: 0, total_time_seconds: 0 });
    });

    it('has no sessions on a rest day or a day without work', () => {
        expect(demoDay(NOVEMBER_12, 5)).toMatchObject({ date: '2026-11-07', state: 'rest', total_sessions: 0, total_time_seconds: 0 });
        expect(demoDay(NOVEMBER_12, 11)).toMatchObject({ date: '2026-11-01', state: 'missed', total_sessions: 0, total_time_seconds: 0 });
    });
});

describe('the days behind', () => {
    /** Return the date of the Monday of the week of a date. */
    function mondayOf(date: Date): string {
        return formatLocalDate(addDays(date, -((date.getDay() + 6) % 7)));
    }

    it.each(Array.from({ length: 14 }, (_, offset) => offset))(
        'gives a week two rest days, and misses the third day without work, when today is %i days after Monday 9 November',
        (offset) => {
            const today = addDays(NOVEMBER_12, offset - 3);
            const noWorkByWeek = new Map<string, string[]>();
            for (let daysAgo = 1; daysAgo <= 90; daysAgo++) {
                const state = demoPastState(today, daysAgo);
                if (state === 'work') continue;
                const week = mondayOf(addDays(today, -daysAgo));
                noWorkByWeek.set(week, [...(noWorkByWeek.get(week) ?? []), state]);
            }
            for (const states of noWorkByWeek.values()) {
                const inOrder = [...states].reverse();
                expect(inOrder.slice(0, 2).every(/** Check a rest day. */ (state) => state === 'rest')).toBe(true);
                expect(inOrder.slice(2).every(/** Check a missed day. */ (state) => state === 'missed')).toBe(true);
            }
        }
    );

    it('shows a week without work on a day from the first day without work on, as rest, not as missed', () => {
        expect(demoPastState(NOVEMBER_12, 5)).toBe('rest');
        expect(demoPastState(NOVEMBER_12, 4)).toBe('rest');
        expect(demoPastState(NOVEMBER_12, 11)).toBe('missed');
        expect(demoPastState(NOVEMBER_12, 13)).toBe('rest');
        expect(demoPastState(NOVEMBER_12, 14)).toBe('work');
    });

    it('focuses between 45 minutes and 2 hours, and more on recent days', () => {
        for (let daysAgo = 0; daysAgo < 60; daysAgo++) {
            expect(demoFocusMinutes(daysAgo)).toBeGreaterThanOrEqual(45);
            expect(demoFocusMinutes(daysAgo)).toBeLessThanOrEqual(120);
        }
        const average = (from: number): number => Array.from({ length: 10 }, (_, index) => demoFocusMinutes(from + index)).reduce((sum, minutes) => sum + minutes, 0) / 10;
        expect(average(0)).toBeGreaterThan(average(20));
    });

    it('has at least one session in a day', () => {
        for (let daysAgo = 0; daysAgo < 60; daysAgo++) expect(demoSessions(daysAgo)).toBeGreaterThanOrEqual(1);
    });

    it('has a streak that stops at a missed day, and that rest days do not break', () => {
        expect(demoCurrentStreak(NOVEMBER_12)).toBe(8);
        expect(demoCurrentStreak(new Date(2026, 10, 9))).toBe(5);
    });

    it('has the two rest days of the current week still to take', () => {
        expect(demoRestDaysRemaining(NOVEMBER_12)).toBe(2);
    });
});

describe('the days of a window', () => {
    it('lists the last days up to today, oldest first, across a change of month', () => {
        const days = demoRecentDays(NOVEMBER_12, 14);
        expect(days).toHaveLength(14);
        expect(at(days, 0).date).toBe('2026-10-30');
        expect(at(days, 13)).toMatchObject({ date: '2026-11-12', state: 'today' });
    });

    it.each([
        [new Date(2026, 10, 12), 30],
        [new Date(2028, 1, 10), 29],
        [new Date(2027, 1, 10), 28],
        [new Date(2026, 11, 31), 31]
    ] as const)('lists every day of the month of %s', (today, length) => {
        const days = demoMonthDays(today);
        expect(days).toHaveLength(length);
        expect(at(days, 0).date.endsWith('-01')).toBe(true);
        expect(days.filter(/** Keep today. */ (day) => day.state === 'today').map(/** Read the date. */ (day) => day.date)).toEqual([formatLocalDate(today)]);
    });

    it('leaves the days after today neutral', () => {
        const days = demoMonthDays(NOVEMBER_12);
        expect(days.slice(12).every(/** Check a day ahead. */ (day) => day.state === 'neutral')).toBe(true);
        expect(at(days, 10).state).toBe('work');
    });

    it('lists the first day of the month with only today in it', () => {
        const days = demoMonthDays(new Date(2026, 11, 1));
        expect(at(days, 0).state).toBe('today');
        expect(days.slice(1).every(/** Check a day ahead. */ (day) => day.state === 'neutral')).toBe(true);
    });

    it('marks the days behind, today and the days ahead of a month', () => {
        const days = getMonthDays(NOVEMBER_12);
        expect(days.filter(/** Keep the days behind. */ (day) => day.kind === 'past')).toHaveLength(11);
        expect(at(days, 11)).toEqual({ day: 12, kind: 'today' });
        expect(days.filter(/** Keep the days ahead. */ (day) => day.kind === 'future')).toHaveLength(18);
    });
});

describe('the days left in the month', () => {
    it.each([
        [new Date(2026, 10, 12), 18],
        [new Date(2026, 10, 30), 0],
        [new Date(2026, 10, 29), 1],
        [new Date(2028, 1, 28), 1],
        [new Date(2028, 1, 29), 0]
    ] as const)('counts them from %s', (today, expected) => {
        expect(getDaysLeftInMonth(today)).toBe(expected);
    });
});

describe('the chart and the stats', () => {
    it('has 30 days ending today, oldest first, one after the other', () => {
        const trend = demoTrend(NOVEMBER_12);
        expect(trend).toHaveLength(30);
        expect(at(trend, 0).bucket_start).toBe('2026-10-14');
        expect(at(trend, 29).bucket_start).toBe('2026-11-12');
    });

    it('keeps every day between 45 minutes and 2 hours', () => {
        for (const bucket of demoTrend(NOVEMBER_12)) {
            expect(bucket.total_time_seconds).toBeGreaterThanOrEqual(45 * 60);
            expect(bucket.total_time_seconds).toBeLessThanOrEqual(120 * 60);
        }
    });

    it('reaches exactly 2 hours today, so the axis of the chart ends at 2h', () => {
        const trend = demoTrend(NOVEMBER_12);
        expect(Math.max(...trend.map(/** Read the time of a day. */ (bucket) => bucket.total_time_seconds))).toBe(2 * 3600);
        expect(at(trend, 29).total_time_seconds).toBe(2 * 3600);
    });

    it('has stats that add up from the days of the chart', () => {
        const trend = demoTrend(NOVEMBER_12);
        const stats = demoStats();
        const totalTime = trend.reduce((sum, bucket) => sum + bucket.total_time_seconds, 0);
        const totalSessions = trend.reduce((sum, bucket) => sum + bucket.total_sessions, 0);
        expect(stats.totalTimeSeconds).toBe(totalTime);
        expect(stats.totalSessions).toBe(totalSessions);
        expect(stats.averageSessionSeconds).toBe(Math.round(totalTime / totalSessions));
    });
});

describe('the demo room', () => {
    it('has five people in order, one of them you', () => {
        expect(DEMO_RANKING.map(/** Read a position. */ (member) => member.position)).toEqual([1, 2, 3, 4, 5]);
        expect(DEMO_RANKING.filter(/** Keep you. */ (member) => member.is_you)).toHaveLength(1);
    });

    it('has people working, one paused and one not working', () => {
        const states = DEMO_RANKING.map(/** Read a state. */ (member) => member.state);
        expect(states.filter(/** Keep the people working. */ (state) => state === 'working').length).toBeGreaterThanOrEqual(2);
        expect(states).toContain('paused');
        expect(states).toContain('not_working');
    });

    it('is ordered by time', () => {
        const times = DEMO_RANKING.map(/** Read a total time. */ (member) => member.total_time_seconds);
        expect(times).toEqual([...times].sort(/** Put the longest first. */ (a, b) => b - a));
    });
});
