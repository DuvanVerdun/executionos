import { at } from '../lib/arrays';
import { formatLocalDate, formatTrendBucketLabel } from '../lib/dates';
import type { DashboardMetric, DashboardPeriod, TrendBucket } from '../types/dashboard';
import {
    createTrendCurvePath,
    formatTrendMetricValue,
    getTrendAxisTicks,
    getTrendMetricValue,
    type ChartPoint
} from './chart-math';

const WIDTH = 700;
const HEIGHT = 260;
const LEFT = 85;
const RIGHT = 20;
const TOP = 25;
const BOTTOM = 45;
const CHART_WIDTH = WIDTH - LEFT - RIGHT;
const CHART_HEIGHT = HEIGHT - TOP - BOTTOM;

interface TrendChartProps {
    buckets: TrendBucket[];
    period: DashboardPeriod;
    metric: DashboardMetric;
}

/** Draw axes, gridlines, and available trend values. */
export function TrendChart({ buckets, period, metric }: TrendChartProps) {
    const today = formatLocalDate(new Date());
    const currentMonth = `${today.slice(0, 7)}-01`;
    const trend = period === 'year'
        ? buckets.filter(/** Retain calendar buckets through the current month. */ (bucket) => bucket.bucket_start <= currentMonth)
        : buckets;

    const svgProps = {
        id: 'dashboard-trend-chart',
        width: '100%',
        height: '260',
        role: 'img',
        'aria-label': 'Execution trend',
        viewBox: '0 0 700 260'
    };
    if (trend.length === 0) return <svg {...svgProps} />;

    const plottedBuckets = trend.filter(/** Retain buckets through the current local day. */ (bucket) => bucket.bucket_start <= today);
    const values = plottedBuckets.map(/** Extract the selected metric from a plotted bucket. */ (bucket) =>
        getTrendMetricValue(bucket, metric)
    );
    const minimumMax = metric === 'time' ? 3600 : metric === 'completion' ? 100 : 1;
    const maxValue = Math.max(...values, minimumMax);

    const axisPoints: ChartPoint[] = trend.map(/** Calculate chart coordinates and metric data for a bucket. */ (bucket, index) => {
        const x = trend.length === 1
            ? LEFT + CHART_WIDTH / 2
            : LEFT + (index / (trend.length - 1)) * CHART_WIDTH;
        const value = getTrendMetricValue(bucket, metric);
        const y = TOP + CHART_HEIGHT - (value / maxValue) * CHART_HEIGHT;
        return { x, y, value, bucket };
    });
    const points = axisPoints.filter(/** Retain chart points through the current local day. */ (point) => point.bucket.bucket_start <= today);
    const labelInterval = Math.max(1, Math.ceil(axisPoints.length / 8));
    const labeledPoints = axisPoints.filter(/** Retain the points that get a label and a vertical gridline. */ (_point, index) =>
        index % labelInterval === 0 || index === axisPoints.length - 1
    );
    const curvePath = createTrendCurvePath(points);

    return (
        <svg {...svgProps}>
            {getTrendAxisTicks(maxValue, metric).map(/** Draw a horizontal gridline and its axis label. */ (value) => {
                const y = TOP + CHART_HEIGHT - (value / maxValue) * CHART_HEIGHT;
                const text = formatTrendMetricValue(value, metric);
                return (
                    <g key={value}>
                        <line x1={LEFT} x2={LEFT + CHART_WIDTH} y1={y} y2={y} className="dashboard-trend-gridline" />
                        <text x={LEFT - 12} y={y} textAnchor="end" dominantBaseline="middle" className="dashboard-trend-axis-label">
                            {text}
                            <title>{text}</title>
                        </text>
                    </g>
                );
            })}
            {labeledPoints.map(/** Draw a vertical gridline at a labeled bucket position. */ (point) => (
                <line key={point.bucket.bucket_start} x1={point.x} x2={point.x} y1={TOP} y2={TOP + CHART_HEIGHT} className="dashboard-trend-gridline" />
            ))}
            {curvePath && (
                <>
                    <defs>
                        <linearGradient id="dashboard-trend-fill" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={TOP} y2={TOP + CHART_HEIGHT}>
                            <stop offset="0" stopColor="var(--color-reward)" stopOpacity="0.2" />
                            <stop offset="1" stopColor="var(--color-reward)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path
                        d={`${curvePath} L ${at(points, points.length - 1).x},${TOP + CHART_HEIGHT} L ${at(points, 0).x},${TOP + CHART_HEIGHT} Z`}
                        fill="url(#dashboard-trend-fill)"
                    />
                    <path d={curvePath} className="dashboard-trend-line" />
                </>
            )}
            {points.map(/** Draw a plotted point and its value tooltip. */ (point) => (
                <circle key={point.bucket.bucket_start} cx={point.x} cy={point.y} r="4" className="dashboard-trend-point">
                    <title>{`${formatTrendBucketLabel(point.bucket.bucket_start, period)}: ${formatTrendMetricValue(point.value, metric)}`}</title>
                </circle>
            ))}
            {labeledPoints.map(/** Draw a label at an eligible bucket position. */ (point) => (
                <text key={point.bucket.bucket_start} x={point.x} y={HEIGHT - 15} textAnchor="middle" className="dashboard-trend-axis-label">
                    {formatTrendBucketLabel(point.bucket.bucket_start, period)}
                </text>
            ))}
        </svg>
    );
}
