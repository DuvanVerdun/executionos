import { useRef, useState, type MouseEvent } from 'react';
import { useRevealedWhenInView } from '../hooks/useRevealedWhenInView';
import { useT } from '../i18n/i18n';
import { at } from '../lib/arrays';
import { withCssVariables } from '../lib/css';
import { formatLocalDate, formatTrendBucketLabel } from '../lib/dates';
import type { DashboardMetric, DashboardPeriod, TrendBucket } from '../types/dashboard';
import {
    createTrendCurvePath,
    formatTrendMetricValue,
    getNearestPoint,
    getTrendAxisTicks,
    getTrendLabelIndexes,
    getTrendMetricValue,
    type ChartPoint
} from './chart-math';
import { TrendSummary } from './TrendSummary';

const WIDTH = 700;
const HEIGHT = 260;
const LEFT = 68;
const RIGHT = 20;
const TOP = 25;
const BOTTOM = 45;
const CHART_WIDTH = WIDTH - LEFT - RIGHT;
const CHART_HEIGHT = HEIGHT - TOP - BOTTOM;

/** How long the chart stays empty when it never comes completely into view. */
const REVEAL_WAIT_MS = 3000;
const MAX_LABELS = 8;
/** A year has room for a label under each of its months. */
const MAX_YEAR_LABELS = 12;

interface TrendChartProps {
    buckets: TrendBucket[];
    period: DashboardPeriod;
    metric: DashboardMetric;
}

/** Draw axes, gridlines, and available trend values. The values appear once the chart is in view, and a card summarizes the point next to the mouse. */
export function TrendChart({ buckets, period, metric }: TrendChartProps) {
    const t = useT();
    const plotRef = useRef<HTMLDivElement>(null);
    const isRevealed = useRevealedWhenInView(plotRef, REVEAL_WAIT_MS);
    const [hoveredStart, setHoveredStart] = useState<string | null>(null);
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
        'aria-label': t('dashboard.trendChart'),
        viewBox: '0 0 700 260'
    };
    if (trend.length === 0) return <div ref={plotRef} className="dashboard-trend-plot"><svg {...svgProps} /></div>;

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
    const labeledPoints = getTrendLabelIndexes(axisPoints.length, period === 'year' ? MAX_YEAR_LABELS : MAX_LABELS).map(
        /** Find the point that gets a label and a vertical gridline. */ (index) => at(axisPoints, index)
    );
    const curvePath = createTrendCurvePath(points);
    const hoveredPoint = isRevealed ? points.find(/** Find the point under the mouse. */ (point) => point.bucket.bucket_start === hoveredStart) ?? null : null;
    const sweepStart = points.length > 0 ? at(points, 0).x : 0;
    const sweepWidth = points.length > 1 ? at(points, points.length - 1).x - sweepStart : 1;

    /** Pick the point closest to the mouse while the mouse is over the plot, and none otherwise. */
    function handleMouseMove(event: MouseEvent<HTMLDivElement>): void {
        const box = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width * WIDTH;
        const y = (event.clientY - box.top) / box.height * HEIGHT;
        const isOverPlot = x >= LEFT && x <= LEFT + CHART_WIDTH && y >= TOP && y <= TOP + CHART_HEIGHT;
        setHoveredStart(isOverPlot ? getNearestPoint(points, x)?.bucket.bucket_start ?? null : null);
    }

    return (
        <div
            ref={plotRef}
            className="dashboard-trend-plot"
            onMouseMove={isRevealed ? handleMouseMove : undefined}
            onMouseLeave={() => { setHoveredStart(null); }}
        >
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
                {hoveredPoint && (
                    <line x1={hoveredPoint.x} x2={hoveredPoint.x} y1={TOP} y2={TOP + CHART_HEIGHT} className="dashboard-trend-hover-line" />
                )}
                {isRevealed && (
                    <g className="dashboard-trend-data">
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
                                    className="dashboard-trend-area"
                                />
                                <path d={curvePath} className="dashboard-trend-line" />
                            </>
                        )}
                        {points.map(/** Draw a plotted point. It appears when the line reaches it. */ (point) => (
                            <circle
                                key={point.bucket.bucket_start}
                                cx={point.x}
                                cy={point.y}
                                r="4"
                                className="dashboard-trend-point"
                                style={withCssVariables({}, { '--sweep': String((point.x - sweepStart) / sweepWidth) })}
                            />
                        ))}
                    </g>
                )}
                {labeledPoints.map(/** Draw a label at an eligible bucket position. */ (point) => (
                    <text key={point.bucket.bucket_start} x={point.x} y={HEIGHT - 15} textAnchor="middle" className="dashboard-trend-axis-label">
                        {formatTrendBucketLabel(point.bucket.bucket_start, period)}
                    </text>
                ))}
            </svg>
            {hoveredPoint && (
                <div
                    key={hoveredPoint.bucket.bucket_start}
                    className="streak-day-summary dashboard-trend-summary"
                    role="tooltip"
                    style={{ left: `${hoveredPoint.x / WIDTH * 100}%`, top: `${hoveredPoint.y / HEIGHT * 100}%` }}
                >
                    <TrendSummary bucket={hoveredPoint.bucket} period={period} metric={metric} />
                </div>
            )}
        </div>
    );
}
