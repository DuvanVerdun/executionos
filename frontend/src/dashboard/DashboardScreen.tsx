import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { getElement } from '../lib/dom';
import { formatLocalDate, formatPeriodDate, parseLocalDate } from '../lib/dates';
import { formatDurationHoursMinutes } from '../lib/durations';
import { useStore } from '../lib/store';
import { waitForMinimumFeedback } from '../lib/timing';
import { handleOpenRooms } from '../rooms/rooms';
import { syncOfflineWork } from '../session/sync';
import { Header } from '../shared/Header';
import { Screen } from '../shared/Screen';
import type { DashboardMetric, DashboardPeriod } from '../types/dashboard';
import {
    changeDashboardMetric,
    changeDashboardPeriod,
    dashboardStore,
    handleDashboardToPlan,
    loadDashboard,
    moveDashboardPeriod,
    type PeriodRange
} from './dashboard';
import { SessionHistory } from './SessionHistory';
import { TrendChart } from './TrendChart';

const PERIODS: readonly { value: DashboardPeriod; label: string }[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'all_time', label: 'All Time' }
];

const METRICS: readonly { value: DashboardMetric; label: string }[] = [
    { value: 'time', label: 'Time' },
    { value: 'completion', label: 'Completion' },
    { value: 'sessions', label: 'Sessions' }
];

/** Return the text of the period label: a month, a year, a range of days, or nothing for all time. */
function getPeriodLabel(period: DashboardPeriod, range: PeriodRange): string {
    if (period === 'all_time' || range.start_date === null) return '';
    if (period === 'month') {
        return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(parseLocalDate(range.start_date));
    }
    if (period === 'year') return String(parseLocalDate(range.start_date).getFullYear());
    return `${formatPeriodDate(range.start_date)} – ${formatPeriodDate(range.end_date)}`;
}

/** Return to Stats below the sticky header, respecting reduced motion. */
function scrollBackToStats(summary: HTMLElement | null): void {
    if (!summary) return;
    const header = getElement('.dashboard-header', HTMLElement);
    const top = window.scrollY + summary.getBoundingClientRect().top - header.getBoundingClientRect().bottom - 24;
    summary.focus({ preventScroll: true });
    window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
}

/** Draw the Dashboard screen. */
export function DashboardScreen() {
    const { period, metric, periodRange, surface, data } = useStore(dashboardStore);
    const [isRetrying, setIsRetrying] = useState(false);
    const [isBackDisabled, setIsBackDisabled] = useState(true);
    const listRef = useRef<HTMLDivElement>(null);
    const summaryRef = useRef<HTMLElement>(null);

    /** Show the shortcut when session history reaches the top of the viewport. */
    const updateBackToStatsButton = useEffectEvent((): void => {
        const firstCard = listRef.current?.querySelector('.dashboard-session-card');
        setIsBackDisabled(
            !firstCard
            || firstCard.getClientRects().length === 0
            || firstCard.getBoundingClientRect().top > 0
        );
    });

    useLayoutEffect(() => {
        updateBackToStatsButton();
    });

    useEffect(() => {
        window.addEventListener('scroll', updateBackToStatsButton, { passive: true });
        window.addEventListener('resize', updateBackToStatsButton);
        return () => {
            window.removeEventListener('scroll', updateBackToStatsButton);
            window.removeEventListener('resize', updateBackToStatsButton);
        };
    }, []);

    /** Retry queued saves and Dashboard loading with a minimum feedback duration. */
    async function handleRetry(): Promise<void> {
        if (dashboardStore.get().isLoading || isRetrying) return;
        const feedbackStartedAt = performance.now();
        setIsRetrying(true);
        try {
            await Promise.all([syncOfflineWork(), loadDashboard(feedbackStartedAt)]);
        } finally {
            await waitForMinimumFeedback(feedbackStartedAt);
            setIsRetrying(false);
        }
    }

    const isAllTime = period === 'all_time';
    const today = formatLocalDate(new Date());
    return (
        <Screen name="dashboard" className="dashboard-screen">

            <div className="dashboard-container">

                <Header
                    screen="dashboard"
                    className="dashboard-header"
                    navigation={[
                        { id: 'dashboard-new-mission-btn', label: 'New Mission', onClick: handleDashboardToPlan },
                        { id: 'dashboard-rooms-btn', label: 'Focus Rooms', onClick: () => { void handleOpenRooms('dashboard'); } }
                    ]}
                />

                <section id="dashboard-content" className="dashboard-content">

                    <section className="dashboard-period-controls">

                        <div className="dashboard-period-toggle">
                            {PERIODS.map(/** Draw a period button. */ (option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    data-dashboard-period={option.value}
                                    className={period === option.value ? 'active' : undefined}
                                    onClick={() => { void changeDashboardPeriod(option.value); }}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="dashboard-period-navigation" hidden={isAllTime}>
                            <button
                                type="button"
                                id="dashboard-previous-period-btn"
                                aria-label="Previous period"
                                disabled={isAllTime}
                                onClick={() => { void moveDashboardPeriod(-1); }}
                            >
                                ‹
                            </button>

                            <p id="dashboard-period-label">{getPeriodLabel(period, periodRange)}</p>

                            <button
                                type="button"
                                id="dashboard-next-period-btn"
                                aria-label="Next period"
                                disabled={isAllTime || periodRange.end_date >= today}
                                onClick={() => { void moveDashboardPeriod(1); }}
                            >
                                ›
                            </button>
                        </div>

                    </section>

                    <div id="dashboard-loading" className="dashboard-loading" role="status" aria-label="Loading dashboard" style={{ display: surface === 'loading' ? 'flex' : 'none' }}>
                        <section className="dashboard-loading-summary" aria-hidden="true">
                            <h2 className="dashboard-content-title">Stats</h2>
                            <div className="dashboard-skeleton dashboard-skeleton-summary"></div>
                        </section>
                        <div className="dashboard-skeleton dashboard-skeleton-chart" aria-hidden="true"></div>
                        <section className="dashboard-loading-history" aria-hidden="true">
                            <h2 className="dashboard-content-title">Session History</h2>
                            <div className="dashboard-skeleton dashboard-skeleton-session"></div>
                        </section>
                    </div>

                    <div id="dashboard-data-container" style={{ display: surface === 'data' ? 'block' : 'none' }}>
                        {data && (
                            <>
                                <section
                                    ref={summaryRef}
                                    id="dashboard-summary-container"
                                    className="dashboard-weekly-stats-container"
                                    tabIndex={-1}
                                >
                                    <h2 className="dashboard-content-title">
                                        Stats
                                    </h2>

                                    <div className="dashboard-summary-grid">
                                        <div className="dashboard-summary-card">
                                            <p id="dashboard-total-time-display" className="dashboard-summary-value">
                                                {formatDurationHoursMinutes(data.summary.total_time_seconds)}
                                            </p>
                                            <p className="dashboard-summary-label">Focused</p>
                                        </div>
                                        <div className="dashboard-summary-card">
                                            <p id="dashboard-amount-of-sessions-display" className="dashboard-summary-value">
                                                {String(data.summary.total_sessions)}
                                            </p>
                                            <p className="dashboard-summary-label">Sessions</p>
                                        </div>
                                        <div className="dashboard-summary-card">
                                            <p id="dashboard-average-percentage-display" className="dashboard-summary-value">
                                                {data.summary.average_completion_percentage === null ? '—' : `${Math.round(data.summary.average_completion_percentage)}%`}
                                            </p>
                                            <p className="dashboard-summary-label">Avg. Completion</p>
                                        </div>
                                        <div className="dashboard-summary-card">
                                            <p id="dashboard-average-session-time-display" className="dashboard-summary-value">
                                                {data.summary.average_session_time_seconds === null ? '—' : formatDurationHoursMinutes(data.summary.average_session_time_seconds)}
                                            </p>
                                            <p className="dashboard-summary-label">Avg. Session Time</p>
                                        </div>
                                    </div>
                                </section>

                                <section className="dashboard-trend-section">

                                    <div className="dashboard-metric-toggle">
                                        {METRICS.map(/** Draw a trend metric button. */ (option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                data-dashboard-metric={option.value}
                                                className={metric === option.value ? 'active' : undefined}
                                                onClick={() => { changeDashboardMetric(option.value); }}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>

                                    <TrendChart buckets={data.trend} period={period} metric={metric} />

                                </section>

                                <div ref={listRef}>
                                    <SessionHistory />
                                </div>
                            </>
                        )}
                    </div>

                    <div id="dashboard-error" className="dashboard-error" role="alert" style={{ display: surface === 'error' ? 'flex' : 'none' }}>
                        <p className="dashboard-error-message">Couldn't reach the server.<br />Please try again in a moment.</p>
                        <button type="button" id="dashboard-retry-btn" disabled={isRetrying} onClick={() => { void handleRetry(); }}>
                            {isRetrying ? 'Retrying…' : 'Retry'}
                        </button>
                    </div>
                    <div id="empty-dashboard-cta-container" className="empty-dashboard-cta-container" style={{ display: surface === 'empty' ? 'flex' : 'none' }}>
                        <h2 className="empty-dashboard-cta-title">No sessions during this period</h2>
                        <p className="empty-dashboard-cta-paragraph">Start a mission and build your consistency.</p>
                        <button id="empty-dashboard-start-mission-btn" className="empty-dashboard-start-mission-btn white-filled-button" onClick={handleDashboardToPlan}>
                            Start Mission
                        </button>
                    </div>

                </section>

            </div>

            <button
                type="button"
                id="dashboard-back-to-stats-btn"
                className="normal-button dashboard-back-to-stats"
                aria-label="Back to stats"
                title="Back to stats"
                aria-hidden={isBackDisabled}
                disabled={isBackDisabled}
                onClick={() => { scrollBackToStats(summaryRef.current); }}
            >
                <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                    <path d="m6 12 6-6 6 6M12 6v12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

        </Screen>
    );
}
