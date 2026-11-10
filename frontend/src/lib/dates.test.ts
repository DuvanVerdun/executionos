import { describe, expect, it } from 'vitest';
import {
    formatLocalDate,
    formatPeriodDate,
    formatSessionDateLabel,
    formatTrendBucketLabel,
    getSessionLocalDateKey,
    groupSessionsByLocalDate,
    normalizePeriodAnchor,
    parseLocalDate,
    parseServerTime,
    shiftMonthAnchor,
    shiftPeriodAnchor
} from './dates';

describe('formatLocalDate and parseLocalDate', () => {
    it('pads the month and the day', () => {
        expect(formatLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('reads a date string as a local calendar date', () => {
        const date = parseLocalDate('2026-11-09');
        expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 10, 9]);
    });

    it('round-trips', () => {
        expect(formatLocalDate(parseLocalDate('2026-12-31'))).toBe('2026-12-31');
    });
});

describe('normalizePeriodAnchor', () => {
    it.each([
        ['week', '2026-11-11', '2026-11-09'],
        ['week', '2026-11-15', '2026-11-09'],
        ['week', '2026-11-09', '2026-11-09'],
        ['month', '2026-11-20', '2026-11-01'],
        ['year', '2026-11-20', '2026-01-01'],
        ['all_time', '2026-11-20', '2026-11-20']
    ] as const)('moves the %s anchor %s to %s', (period, anchor, expected) => {
        expect(normalizePeriodAnchor(period, anchor)).toBe(expected);
    });
});

describe('shiftPeriodAnchor', () => {
    it.each([
        ['week', '2026-11-11', -1, '2026-11-02'],
        ['week', '2026-11-11', 1, '2026-11-16'],
        ['month', '2026-11-11', 1, '2026-12-01'],
        ['month', '2026-01-11', -1, '2025-12-01'],
        ['year', '2026-11-11', -1, '2025-01-01']
    ] as const)('moves the %s anchor %s by %i to %s', (period, anchor, direction, expected) => {
        expect(shiftPeriodAnchor(period, anchor, direction)).toBe(expected);
    });
});

describe('shiftMonthAnchor', () => {
    it('does not overflow from a long month to a short one', () => {
        expect(shiftMonthAnchor('2026-03-31', 1)).toBe('2026-04-01');
    });

    it('crosses the year', () => {
        expect(shiftMonthAnchor('2026-01-15', -1)).toBe('2025-12-01');
    });
});

describe('server times (UTC without a Z)', () => {
    it('reads a server time as UTC', () => {
        expect(parseServerTime('2026-11-09T12:00:00')).toBe(Date.UTC(2026, 10, 9, 12));
    });

    it('puts a session on the local day it happened', () => {
        expect(getSessionLocalDateKey({ date: '2026-11-10T01:30:00' })).toBe('2026-11-09');
    });

    it('labels a session day for the history cards', () => {
        expect(formatSessionDateLabel({ date: '2026-11-09T15:00:00' })).toBe('Monday, November 9');
    });

    it('groups sessions by local day and keeps their order', () => {
        const sessions = [
            { date: '2026-11-10T05:00:00', id: 1 },
            { date: '2026-11-10T04:00:00', id: 2 },
            { date: '2026-11-09T20:00:00', id: 3 }
        ];
        const groups = groupSessionsByLocalDate(sessions);
        expect([...groups.keys()]).toEqual(['2026-11-10', '2026-11-09']);
        expect(groups.get('2026-11-10')?.map(/** Read the id of a session. */ (session) => session.id)).toEqual([1, 2]);
    });
});

describe('period and chart labels', () => {
    it('shows nothing for a missing date', () => {
        expect(formatPeriodDate(null)).toBe('');
    });

    it('formats a date for period navigation', () => {
        expect(formatPeriodDate('2026-11-09')).toBe('Nov 9');
    });

    it.each([
        ['week', 'Mon'],
        ['month', '9'],
        ['year', 'Nov'],
        ['all_time', 'Nov']
    ] as const)('labels a bucket in a %s view as %s', (period, label) => {
        expect(formatTrendBucketLabel('2026-11-09', period)).toBe(label);
    });
});
