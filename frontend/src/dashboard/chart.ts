// The trend chart.

import { at } from '../lib/arrays';
import { formatLocalDate, formatTrendBucketLabel } from '../lib/dates';
import { formatDurationHoursMinutes } from '../lib/durations';
import type { DashboardMetric, TrendBucket } from '../types/dashboard';
import { dashboardDom } from './dom';
import { dashboardState } from './state';

/** A point on the trend chart: its position, its value and the bucket it shows. */
interface ChartPoint {
    x: number;
    y: number;
    value: number;
    bucket: TrendBucket;
}

/** Select the numeric value for a trend metric. */
function getTrendMetricValue(bucket: TrendBucket, metric: DashboardMetric): number {
    if (metric === 'time') {
        return bucket.total_time_seconds;
    }
    if (metric === 'completion') {
        return bucket.average_completion_percentage ?? 0;
    }
    return bucket.total_sessions;
}

/** Format a trend value for its metric. */
function formatTrendMetricValue(value: number, metric: DashboardMetric): string {
    if (metric === 'time') {
        return formatDurationHoursMinutes(value);
    }
    if (metric === 'completion') {
        return `${Math.round(value)}%`;
    }
    return String(value);
}

/** Mark the selected trend metric button. */
export function renderTrendMetricButtons(): void {
    dashboardDom.metricButtons.forEach(/** Mark the button for the selected trend metric. */ (button) => {
        button.classList.toggle(
            'active',
            button.dataset.dashboardMetric === dashboardState.metric
        );
    });
}

/** Generate spaced axis ticks including the exact maximum. */
function getTrendAxisTicks(maxValue: number, metric: DashboardMetric): number[] {

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
function createTrendCurvePath(points: ChartPoint[]): string {
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

/** Render axes, gridlines, and available trend values as SVG. */
export function renderTrendChart(): void {
    const svg = dashboardDom.trendChart;
    const today = formatLocalDate(new Date());
    const currentMonth = `${today.slice(0, 7)}-01`;
    const allBuckets = dashboardState.data?.trend ?? [];

    const trend = dashboardState.period === 'year'
        ? allBuckets.filter(/** Retain calendar buckets through the current month. */ (bucket) => bucket.bucket_start <= currentMonth)
        : allBuckets;

    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 700 260');

    if (trend.length === 0) return;

    const width = 700;
    const height = 260;

    const left = 85;
    const right = 20;
    const top = 25;
    const bottom = 45;

    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    const plottedBuckets = trend.filter(/** Retain buckets through the current local day. */ (bucket) => bucket.bucket_start <= today);
    const values = plottedBuckets.map(/** Extract the selected metric from a plotted bucket. */ (bucket) =>
        getTrendMetricValue(bucket, dashboardState.metric)
    );

    const minimumMax = dashboardState.metric === 'time'
        ? 3600
        : dashboardState.metric === 'completion' ? 100 : 1;
    const maxValue = Math.max(...values, minimumMax);

    /** Create an element in the SVG namespace. */
    const createSvgElement = <K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] =>
        document.createElementNS(
            'http://www.w3.org/2000/svg',
            tag
        );

    getTrendAxisTicks(maxValue, dashboardState.metric).forEach(/** Append a horizontal gridline and its axis label. */ (value) => {
        const y = top + chartHeight - (value / maxValue) * chartHeight;
        const gridline = createSvgElement('line');
        gridline.setAttribute('x1', String(left));
        gridline.setAttribute('x2', String(left + chartWidth));
        gridline.setAttribute('y1', String(y));
        gridline.setAttribute('y2', String(y));
        gridline.setAttribute('class', 'dashboard-trend-gridline');
        svg.appendChild(gridline);

        const label = createSvgElement('text');
        label.setAttribute('x', String(left - 12));
        label.setAttribute('y', String(y));
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('class', 'dashboard-trend-axis-label');
        label.textContent = formatTrendMetricValue(value, dashboardState.metric);
        const title = createSvgElement('title');
        title.textContent = label.textContent;
        label.appendChild(title);
        svg.appendChild(label);
    });

    const axisPoints = trend.map(/** Calculate chart coordinates and metric data for a bucket. */ (bucket, index) => {
        const x = trend.length === 1
            ? left + chartWidth / 2
            : left + (index / (trend.length - 1)) * chartWidth;

        const value = getTrendMetricValue(bucket, dashboardState.metric);

        const y =
            top
            + chartHeight
            - (value / maxValue) * chartHeight;

        return {
            x,
            y,
            value,
            bucket
        };
    });

    const points = axisPoints.filter(/** Retain chart points through the current local day. */ (point) => point.bucket.bucket_start <= today);
    const labelInterval = Math.max(1, Math.ceil(axisPoints.length / 8));
    axisPoints.forEach(/** Append vertical gridlines at labeled bucket positions. */ (point, index) => {
        if (index % labelInterval !== 0 && index !== axisPoints.length - 1) return;
        const gridline = createSvgElement('line');
        gridline.setAttribute('x1', String(point.x));
        gridline.setAttribute('x2', String(point.x));
        gridline.setAttribute('y1', String(top));
        gridline.setAttribute('y2', String(top + chartHeight));
        gridline.setAttribute('class', 'dashboard-trend-gridline');
        svg.appendChild(gridline);
    });

    const curvePath = createTrendCurvePath(points);
    if (curvePath) {
        const defs = createSvgElement('defs');
        const gradient = createSvgElement('linearGradient');
        gradient.setAttribute('id', 'dashboard-trend-fill');
        gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
        gradient.setAttribute('x1', '0');
        gradient.setAttribute('x2', '0');
        gradient.setAttribute('y1', String(top));
        gradient.setAttribute('y2', String(top + chartHeight));
        [0, 1].forEach(/** Append a color stop to the trend area gradient. */ (offset) => {
            const stop = createSvgElement('stop');
            stop.setAttribute('offset', String(offset));
            stop.setAttribute('stop-color', 'var(--color-reward)');
            stop.setAttribute('stop-opacity', String(offset === 0 ? '0.2' : '0'));
            gradient.appendChild(stop);
        });
        defs.appendChild(gradient);
        svg.appendChild(defs);

        const area = createSvgElement('path');
        area.setAttribute('d', `${curvePath} L ${at(points, points.length - 1).x},${top + chartHeight}`
            + ` L ${at(points, 0).x},${top + chartHeight} Z`);
        area.setAttribute('fill', 'url(#dashboard-trend-fill)');
        svg.appendChild(area);

        const line = createSvgElement('path');
        line.setAttribute('d', String(curvePath));
        line.setAttribute('class', 'dashboard-trend-line');
        svg.appendChild(line);
    }

    points.forEach(/** Append a plotted point and its value tooltip. */ (point) => {
        const circle = createSvgElement('circle');

        circle.setAttribute('cx', String(point.x));
        circle.setAttribute('cy', String(point.y));
        circle.setAttribute('r', '4');
        circle.setAttribute('class', 'dashboard-trend-point');

        const title = createSvgElement('title');

        title.textContent =
            `${formatTrendBucketLabel(
                point.bucket.bucket_start,
                dashboardState.period
            )}: ${formatTrendMetricValue(
                point.value,
                dashboardState.metric
            )}`;

        circle.appendChild(title);
        svg.appendChild(circle);

    });

    axisPoints.forEach(/** Append a label at an eligible bucket position. */ (point, index) => {
        const shouldRenderLabel =
            index % labelInterval === 0
            || index === axisPoints.length - 1;

        if (!shouldRenderLabel) return;

        const label = createSvgElement('text');

        label.setAttribute('x', String(point.x));
        label.setAttribute('y', String(height - 15));
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'dashboard-trend-axis-label');

        label.textContent = formatTrendBucketLabel(
            point.bucket.bucket_start,
            dashboardState.period
        );

        svg.appendChild(label);
    });
}
