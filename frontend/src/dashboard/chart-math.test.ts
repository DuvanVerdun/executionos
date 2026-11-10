import { describe, expect, it } from 'vitest';
import type { TrendBucket } from '../types/dashboard';
import { createTrendCurvePath, formatTrendMetricValue, getTrendAxisTicks, getTrendMetricValue, type ChartPoint } from './chart-math';

const bucket: TrendBucket = {
    bucket_start: '2026-11-09',
    total_time_seconds: 3600,
    total_sessions: 3,
    average_completion_percentage: 66.6
};

/** Make a chart point at a position. */
function point(x: number, y: number): ChartPoint {
    return { x, y, value: y, bucket };
}

describe('getTrendMetricValue', () => {
    it('reads the value of the chosen metric', () => {
        expect(getTrendMetricValue(bucket, 'time')).toBe(3600);
        expect(getTrendMetricValue(bucket, 'sessions')).toBe(3);
        expect(getTrendMetricValue(bucket, 'completion')).toBe(66.6);
    });

    it('counts a bucket without sessions as 0% completion', () => {
        expect(getTrendMetricValue({ ...bucket, average_completion_percentage: null }, 'completion')).toBe(0);
    });
});

describe('formatTrendMetricValue', () => {
    it.each([
        [3600, 'time', '1h 0m'],
        [66.6, 'completion', '67%'],
        [3, 'sessions', '3']
    ] as const)('shows %d for %s as %s', (value, metric, text) => {
        expect(formatTrendMetricValue(value, metric)).toBe(text);
    });
});

describe('getTrendAxisTicks', () => {
    it('spreads ticks evenly and ends at the maximum', () => {
        expect(getTrendAxisTicks(100, 'completion')).toEqual([0, 25, 50, 75, 100]);
    });

    it('steps by whole minutes for time', () => {
        expect(getTrendAxisTicks(3600, 'time')).toEqual([0, 900, 1800, 2700, 3600]);
    });

    it('steps by whole sessions for a small maximum', () => {
        expect(getTrendAxisTicks(1, 'sessions')).toEqual([0, 1]);
    });
});

describe('createTrendCurvePath', () => {
    it('draws nothing for fewer than two points', () => {
        expect(createTrendCurvePath([])).toBe('');
        expect(createTrendCurvePath([point(0, 0)])).toBe('');
    });

    it('starts at the first point and ends at the last', () => {
        const path = createTrendCurvePath([point(0, 10), point(100, 50)]);
        expect(path.startsWith('M 0,10 C')).toBe(true);
        expect(path.endsWith(' 100,50')).toBe(true);
    });

    it('keeps the curve flat at a peak, so it does not overshoot', () => {
        const path = createTrendCurvePath([point(0, 0), point(30, 90), point(60, 0)]);
        expect(path).toMatch(/ 20,90 /);
    });
});
