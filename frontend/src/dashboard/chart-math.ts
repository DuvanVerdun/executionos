import { at } from '../lib/arrays';
import { formatDurationHoursMinutes } from '../lib/durations';
import type { DashboardMetric, TrendBucket } from '../types/dashboard';

/** A point on the trend chart: its position, its value and the bucket it shows. */
export interface ChartPoint {
    x: number;
    y: number;
    value: number;
    bucket: TrendBucket;
}

/** Select the numeric value for a trend metric. */
export function getTrendMetricValue(bucket: TrendBucket, metric: DashboardMetric): number {
    if (metric === 'time') {
        return bucket.total_time_seconds;
    }
    if (metric === 'completion') {
        return bucket.average_completion_percentage ?? 0;
    }
    return bucket.total_sessions;
}

/** Format a trend value for its metric. */
export function formatTrendMetricValue(value: number, metric: DashboardMetric): string {
    if (metric === 'time') {
        return formatDurationHoursMinutes(value);
    }
    if (metric === 'completion') {
        return `${Math.round(value)}%`;
    }
    return String(value);
}

/** Generate spaced axis ticks including the exact maximum. */
export function getTrendAxisTicks(maxValue: number, metric: DashboardMetric): number[] {

    const unit = metric === 'time' ? 60 : 1;
    const step = Math.max(unit, Math.floor(maxValue / 4 / unit) * unit);
    const ticks = [0];
    for (let value = step; value < maxValue; value += step) {

        if (maxValue - value >= step / 2) ticks.push(value);
    }
    ticks.push(maxValue);
    return ticks;
}

/** Build a cubic curve path with flat tangents at local extrema. */
export function createTrendCurvePath(points: ChartPoint[]): string {
    if (points.length < 2) return '';
    const slopes = points.slice(1).map(/** Calculate the slope between adjacent chart points. */ (point, index) =>
        (point.y - at(points, index).y) / (point.x - at(points, index).x)
    );
    const tangents = points.map(/** Calculate the tangent at a chart point. */ (_point, index) => {
        if (index === 0) return at(slopes, 0);
        if (index === points.length - 1) return at(slopes, index - 1);
        const before = at(slopes, index - 1);
        const after = at(slopes, index);

        if (before * after <= 0) return 0;
        return 2 * before * after / (before + after);
    });
    let path = `M ${at(points, 0).x},${at(points, 0).y}`;
    points.slice(1).forEach(/** Append the cubic segment ending at this chart point. */ (point, index) => {
        const previous = at(points, index);
        const thirdWidth = (point.x - previous.x) / 3;
        path += ` C ${previous.x + thirdWidth},${previous.y + at(tangents, index) * thirdWidth}`
            + ` ${point.x - thirdWidth},${point.y - at(tangents, index + 1) * thirdWidth}`
            + ` ${point.x},${point.y}`;
    });
    return path;
}

/**
 * Choose which buckets get a label and a vertical gridline: the first, the last, and the ones between them as evenly spaced as whole buckets allow.
 * A month of 30 days has gaps of 4 and 5 days, and never two labels side by side.
 */
export function getTrendLabelIndexes(bucketCount: number, maxLabels: number): number[] {
    const labelCount = Math.min(bucketCount, maxLabels);
    if (labelCount < 2) return [0];
    return Array.from({ length: labelCount }, /** Spread the labels from the first bucket to the last one. */ (_, label) =>
        Math.round(label * (bucketCount - 1) / (labelCount - 1))
    );
}

/** Return the point whose position is the closest to an horizontal position, or null when there are no points. */
export function getNearestPoint(points: ChartPoint[], x: number): ChartPoint | null {
    return points.reduce<ChartPoint | null>(/** Keep the closest point so far. */ (nearest, point) =>
        nearest === null || Math.abs(point.x - x) < Math.abs(nearest.x - x) ? point : nearest, null);
}
