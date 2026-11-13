import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { useT, type TranslationKey } from '../i18n/i18n';
import { getElement } from '../lib/dom';
import { formatDurationHoursMinutes } from '../lib/durations';
import { useStore } from '../lib/store';
import { waitForMinimumFeedback } from '../lib/timing';
import { syncOfflineWork } from '../session/sync';
import { Header } from '../shared/Header';
import { Screen } from '../shared/Screen';
import type { DashboardMetric } from '../types/dashboard';
import {
    changeDashboardMetric,
    dashboardStore,
    handleDashboardToPlan,
    loadDashboard
} from './dashboard';
import { FilterMenu } from './FilterMenu';
import { PeriodControls } from './PeriodControls';
import { SessionHistory } from './SessionHistory';
import { TrendChart } from './TrendChart';

const METRICS = [
    { value: 'time', label: 'dashboard.metricTime' },
    { value: 'completion', label: 'dashboard.metricCompletion' },
    { value: 'sessions', label: 'dashboard.metricSessions' }
] as const satisfies readonly { value: DashboardMetric; label: TranslationKey }[];

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
    const t = useT();
    const { period, metric, surface, data, loadedKey } = useStore(dashboardStore);
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

    return (
        <Screen name="dashboard" className="dashboard-screen">

            <div className="dashboard-container">

                <Header screen="dashboard" className="dashboard-header" />

                <section id="dashboard-content" className="dashboard-content">

                    <section ref={summaryRef} className="dashboard-stats-header" tabIndex={-1}>
                        {surface !== 'empty' && surface !== 'error' && <h2 className="dashboard-content-title">{t('dashboard.stats')}</h2>}
                        <PeriodControls />
                    </section>

                    <div id="dashboard-loading" className="dashboard-loading" role="status" aria-label={t('dashboard.loading')} style={{ display: surface === 'loading' ? 'flex' : 'none' }}>
                        <div className="dashboard-skeleton dashboard-skeleton-summary" aria-hidden="true"></div>
                        <div className="dashboard-skeleton dashboard-skeleton-chart" aria-hidden="true"></div>
                        <section className="dashboard-loading-history" aria-hidden="true">
                            <h2 className="dashboard-content-title">{t('dashboard.sessionHistory')}</h2>
                            <div className="dashboard-skeleton dashboard-skeleton-session"></div>
                        </section>
                    </div>

                    <div id="dashboard-data-container" style={{ display: surface === 'data' ? 'block' : 'none' }}>
                        {data && (
                            <>
                                <section id="dashboard-summary-container" className="dashboard-weekly-stats-container">
                                    <div className="dashboard-summary-grid">
                                        <div className="dashboard-summary-card">
                                            <p id="dashboard-total-time-display" className="dashboard-summary-value">
                                                {formatDurationHoursMinutes(data.summary.total_time_seconds)}
                                            </p>
                                            <p className="dashboard-summary-label">{t('review.focused')}</p>
                                        </div>
                                        <div className="dashboard-summary-card">
                                            <p id="dashboard-amount-of-sessions-display" className="dashboard-summary-value">
                                                {String(data.summary.total_sessions)}
                                            </p>
                                            <p className="dashboard-summary-label">{t('review.sessions')}</p>
                                        </div>
                                        <div className="dashboard-summary-card">
                                            <p id="dashboard-average-percentage-display" className="dashboard-summary-value">
                                                {data.summary.average_completion_percentage === null ? '—' : `${Math.round(data.summary.average_completion_percentage)}%`}
                                            </p>
                                            <p className="dashboard-summary-label">{t('dashboard.averageCompletion')}</p>
                                        </div>
                                        <div className="dashboard-summary-card">
                                            <p id="dashboard-average-session-time-display" className="dashboard-summary-value">
                                                {data.summary.average_session_time_seconds === null ? '—' : formatDurationHoursMinutes(data.summary.average_session_time_seconds)}
                                            </p>
                                            <p className="dashboard-summary-label">{t('review.averageSessionTime')}</p>
                                        </div>
                                    </div>
                                </section>

                                <section className="dashboard-trend-section">

                                    <div className="dashboard-trend-header">
                                        <h2 className="dashboard-content-title">{t('dashboard.chartTitle')}</h2>
                                        <FilterMenu
                                            label="dashboard.chooseMetric"
                                            options={METRICS}
                                            selected={metric}
                                            onSelect={changeDashboardMetric}
                                        />
                                    </div>

                                    <TrendChart key={`${loadedKey}:${metric}`} buckets={data.trend} period={period} metric={metric} />

                                </section>

                                <div ref={listRef}>
                                    <SessionHistory />
                                </div>
                            </>
                        )}
                    </div>

                    <div id="dashboard-error" className="dashboard-error" role="alert" style={{ display: surface === 'error' ? 'flex' : 'none' }}>
                        <p className="dashboard-error-message">{t('dashboard.unreachable')}<br />{t('dashboard.tryAgainSoon')}</p>
                        <button type="button" id="dashboard-retry-btn" disabled={isRetrying} onClick={() => { void handleRetry(); }}>
                            {isRetrying ? t('loading.retrying') : t('common.retry')}
                        </button>
                    </div>
                    <div id="empty-dashboard-cta-container" className="empty-dashboard-cta-container" style={{ display: surface === 'empty' ? 'flex' : 'none' }}>
                        <h2 className="empty-dashboard-cta-title">{t('dashboard.emptyTitle')}</h2>
                        <p className="empty-dashboard-cta-paragraph">{t('dashboard.emptyText')}</p>
                        <button id="empty-dashboard-start-mission-btn" className="empty-dashboard-start-mission-btn white-filled-button" onClick={handleDashboardToPlan}>
                            {t('dashboard.startMission')}
                        </button>
                    </div>

                </section>

            </div>

            <button
                type="button"
                id="dashboard-back-to-stats-btn"
                className="normal-button dashboard-back-to-stats"
                aria-label={t('dashboard.backToStats')}
                title={t('dashboard.backToStats')}
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
