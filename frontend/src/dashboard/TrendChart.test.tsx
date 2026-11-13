import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getElement } from '../lib/dom';
import type { TrendBucket } from '../types/dashboard';
import { TrendChart } from './TrendChart';

/** Make the bucket of a day. */
function day(bucketStart: string, overrides: Partial<TrendBucket> = {}): TrendBucket {
    return { bucket_start: bucketStart, total_time_seconds: 0, total_sessions: 0, average_completion_percentage: null, is_rest_day: false, ...overrides };
}

const WEEK = [
    day('2026-11-09', { total_time_seconds: 3600, total_sessions: 2, average_completion_percentage: 80 }),
    day('2026-11-10', { is_rest_day: true }),
    day('2026-11-11'),
    day('2026-11-12'),
    day('2026-11-13'),
    day('2026-11-14'),
    day('2026-11-15')
];

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 10, 15, 12, 0));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 700, height: 260 } as DOMRect);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

/** Render the chart of the week, and wait until it shows its values. */
function renderRevealedWeek(metric: 'time' | 'completion' | 'sessions'): HTMLElement {
    render(<TrendChart buckets={WEEK} period="week" metric={metric} />);
    act(() => { vi.advanceTimersByTime(3000); });
    return getElement('.dashboard-trend-plot', HTMLElement);
}

/** Put the mouse over a horizontal position of the chart, inside its plot. */
function hoverAt(plot: HTMLElement, x: number): void {
    fireEvent.mouseMove(plot, { clientX: x, clientY: 100 });
}

describe('revealing the values', () => {
    it('draws the chart empty, and its values after 3 seconds', () => {
        const { container } = render(<TrendChart buckets={WEEK} period="week" metric="time" />);
        expect(container.querySelectorAll('.dashboard-trend-point')).toHaveLength(0);
        act(() => { vi.advanceTimersByTime(3000); });
        expect(container.querySelectorAll('.dashboard-trend-point')).toHaveLength(7);
    });

    it('shows no summary while the chart is empty', () => {
        render(<TrendChart buckets={WEEK} period="week" metric="time" />);
        hoverAt(getElement('.dashboard-trend-plot', HTMLElement), 100);
        expect(screen.queryByRole('tooltip')).toBeNull();
    });
});

describe('hovering the chart', () => {
    it('summarizes the day closest to the mouse, with its line', () => {
        const plot = renderRevealedWeek('time');
        hoverAt(plot, 70);
        expect(screen.getByRole('tooltip')).toHaveTextContent('Mon, Nov 9');
        expect(screen.getByRole('tooltip')).toHaveTextContent('2 sessions · 1h 0m focused');
        expect(plot.querySelectorAll('.dashboard-trend-hover-line')).toHaveLength(1);
    });

    it('says a rest day is a rest day', () => {
        hoverAt(renderRevealedWeek('time'), 190);
        expect(screen.getByRole('tooltip')).toHaveTextContent('Tue, Nov 10');
        expect(screen.getByRole('tooltip')).toHaveTextContent('Rest day');
    });

    it.each([
        ['time', '0m focused'],
        ['completion', '0% completion'],
        ['sessions', 'No sessions']
    ] as const)('says what a day without sessions holds for %s', (metric, text) => {
        hoverAt(renderRevealedWeek(metric), 310);
        expect(screen.getByRole('tooltip')).toHaveTextContent('Wed, Nov 11');
        expect(screen.getByRole('tooltip')).toHaveTextContent(text);
    });

    it('goes away when the mouse leaves the chart', () => {
        const plot = renderRevealedWeek('time');
        hoverAt(plot, 70);
        fireEvent.mouseLeave(plot);
        expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('does nothing when the mouse is outside the plot', () => {
        const plot = renderRevealedWeek('time');
        fireEvent.mouseMove(plot, { clientX: 10, clientY: 100 });
        expect(screen.queryByRole('tooltip')).toBeNull();
    });
});
