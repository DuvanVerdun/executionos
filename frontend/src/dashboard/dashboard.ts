// Dashboard screen: loading, summary, periods, pagination.

import { feedbackDom } from '../feedback/dom';
import { closeFeedbackForm } from '../feedback/feedback';
import {
    formatLocalDate,
    formatPeriodDate,
    normalizePeriodAnchor,
    parseLocalDate,
    shiftPeriodAnchor
} from '../lib/dates';
import { formatDurationHoursMinutes } from '../lib/durations';
import { closestElement } from '../lib/dom';
import { waitForMinimumFeedback } from '../lib/timing';
import { planDom } from '../session/dom';
import { syncOfflineWork } from '../session/sync';
import { navigateTo } from '../shared/navigation';
import type { DashboardData, DashboardMetric, DashboardPeriod } from '../types/dashboard';
import {
    closeSessionMenusOnOutsideClick,
    handleDeleteSession,
    toggleSessionMenu
} from '../shared/session-cards';
import { loadStreak } from '../streak/calendar';
import { fetchDashboardData, fetchSessionsPage } from './api';
import { handleBackToStats, updateBackToStatsButton } from './back-to-stats';
import { renderTrendChart, renderTrendMetricButtons } from './chart';
import { dashboardDom } from './dom';
import { renderSessionsByDate } from './history';
import { dashboardState } from './state';

/** Initialize the selected period's date while preserving previous selections. */
export function initializeDashboardState(): void {
    const period = dashboardState.period;
    if (period === 'all_time' || !dashboardState.anchorDates[period]) {
        dashboardState.anchorDates[period] = normalizePeriodAnchor(
            period,
            formatLocalDate(new Date())
        );
    }
}

/** Show Dashboard loading surfaces and hide results and errors. */
function showDashboardLoading(): void {
    dashboardDom.error.style.display = 'none';
    dashboardDom.dataContainer.style.display = 'none';
    dashboardDom.emptyCTA.style.display = 'none';
    dashboardDom.loading.style.display = 'flex';
    updateBackToStatsButton();
}

/** Hide Dashboard loading surfaces. */
function hideDashboardLoading(): void {
    dashboardDom.loading.style.display = 'none';
}

/** Show Dashboard error feedback and hide loading and results. */
function showDashboardError(): void {
    hideDashboardLoading();
    dashboardDom.dataContainer.style.display = 'none';
    dashboardDom.emptyCTA.style.display = 'none';
    dashboardDom.error.style.display = 'flex';
    updateBackToStatsButton();
}

/** Update the Dashboard's summary values. */
function renderDashboardSummary(summary: DashboardData['summary']): void {
    dashboardDom.sessionCount.textContent = String(summary.total_sessions);
    dashboardDom.totalTime.textContent = formatDurationHoursMinutes(summary.total_time_seconds);
    dashboardDom.averagePercentage.textContent =
        summary.average_completion_percentage === null
            ? '—'
            : `${Math.round(summary.average_completion_percentage)}%`;
    dashboardDom.averageSessionTime.textContent =
        summary.average_session_time_seconds === null
            ? '—'
            : `${formatDurationHoursMinutes(
                summary.average_session_time_seconds
            )}`;
}

/** The dates of the selected period. An all-time period has no start date. */
interface PeriodRange {
    start_date: string | null;
    end_date: string;
}

/** Return the start date of a bounded period. Month and year views always have one. */
function requireStartDate(periodData: PeriodRange): string {
    if (periodData.start_date === null) throw new Error('A bounded period needs a start date.');
    return periodData.start_date;
}

/** Update selected period controls and calendar navigation. */
function renderDashboardPeriod(periodData: PeriodRange): void {
    dashboardDom.periodButtons.forEach(/** Mark the button for the selected Dashboard period. */ (button) => {
        button.classList.toggle(
            'active',
            button.dataset.dashboardPeriod === dashboardState.period
        );
    });

    if (dashboardState.period === 'all_time') {
        dashboardDom.periodLabel.textContent = '';
    } else if (dashboardState.period === 'month') {
        dashboardDom.periodLabel.textContent = new Intl.DateTimeFormat('en-US', {
            month: 'long'
        }).format(parseLocalDate(requireStartDate(periodData)));
    } else if (dashboardState.period === 'year') {
        dashboardDom.periodLabel.textContent =
            String(parseLocalDate(requireStartDate(periodData)).getFullYear());
    } else {
        dashboardDom.periodLabel.textContent =
            `${formatPeriodDate(periodData.start_date)} – ` +
            `${formatPeriodDate(periodData.end_date)}`;
    }

    dashboardDom.periodNavigation.hidden =
        dashboardState.period === 'all_time';

    dashboardDom.previousPeriodButton.disabled =
        dashboardState.period === 'all_time';

    const today = formatLocalDate(new Date());

    dashboardDom.nextPeriodButton.disabled =
        dashboardState.period === 'all_time'
        || periodData.end_date >= today;
}

/** Render navigation from the current Dashboard selection. */
function renderSelectedDashboardPeriod(): void {
    if (dashboardState.period === 'all_time') {
        renderDashboardPeriod({ start_date: null, end_date: '' });
        return;
    }
    const start = normalizePeriodAnchor(dashboardState.period, dashboardState.anchorDates[dashboardState.period]);
    const end = parseLocalDate(start);
    if (dashboardState.period === 'week') end.setDate(end.getDate() + 6);
    else if (dashboardState.period === 'month') end.setMonth(end.getMonth() + 1, 0);
    else end.setMonth(11, 31);
    renderDashboardPeriod({start_date: start, end_date: formatLocalDate(end)});
}

/** Render summary, chart, and history or the empty-period state. */
function renderDashboardData(): void {
    if (!dashboardState.data) return;

    renderDashboardPeriod(
        dashboardState.data.period
    );

    if (
        dashboardState.data.summary.total_sessions === 0
    ) {
        dashboardDom.dataContainer.style.display = 'none';
        dashboardDom.emptyCTA.style.display = 'flex';
        updateBackToStatsButton();
        return;
    }

    dashboardDom.dataContainer.style.display = 'block';
    dashboardDom.emptyCTA.style.display = 'none';

    renderDashboardSummary(
        dashboardState.data.summary
    );

    renderTrendMetricButtons();
    renderTrendChart();

    renderSessionsByDate(
        dashboardState.sessions
    );

    setupSessionsPaginationObserver();
}

/** Observe the history sentinel to load more sessions. */
function setupSessionsPaginationObserver(): void {
    if (dashboardState.sessionObserver) {
        dashboardState.sessionObserver.disconnect();
    }

    if (dashboardState.isLoading || !dashboardState.nextCursor) {
        dashboardDom.sessionsLoadSentinel.style.display = 'none';
        return;
    }

    dashboardDom.sessionsLoadSentinel.style.display = 'flex';
    if (dashboardState.paginationFailed) return;

    dashboardState.sessionObserver = new IntersectionObserver(
        /** Load another history page when the sentinel enters the viewport. */
        async (entries) => {
            if (!entries[0]?.isIntersecting) return;

            await loadMoreSessions();
        },
        {
            root: null,
            rootMargin: '300px'
        }
    );

    dashboardState.sessionObserver.observe(
        dashboardDom.sessionsLoadSentinel
    );
}

/** Fetch and append the next session page for the current period. */
async function loadMoreSessions(): Promise<void> {
    if (
        dashboardState.isLoading
        || dashboardState.paginationFailed
        || dashboardState.isLoadingMore
        || !dashboardState.nextCursor
    ) {
        return;
    }

    const generation = dashboardState.loadGeneration;
    dashboardState.isLoadingMore = true;
    dashboardDom.paginationRetryButton.hidden = true;
    dashboardDom.paginationMessage.textContent = 'Loading more...';

    try {
        const result = await fetchSessionsPage(
            dashboardState.period,
            dashboardState.anchorDates[dashboardState.period],
            dashboardState.nextCursor
        );

        if (generation !== dashboardState.loadGeneration) return;

        if (!result.success) {
            throw new Error(result.error);
        }

        dashboardState.sessions.push(...result.sessions);

        Object.assign(
            dashboardState.dailySummaries,
            result.daily_summaries
        );

        dashboardState.nextCursor = result.next_cursor;

        dashboardDom.paginationMessage.textContent = '';
        renderSessionsByDate(dashboardState.sessions);

    } catch (error) {
        if (generation !== dashboardState.loadGeneration) return;
        console.error('Session pagination error:', error);
        dashboardState.paginationFailed = true;
        dashboardState.sessionObserver?.disconnect();
        dashboardDom.paginationMessage.textContent = "Couldn't load more sessions.";
        dashboardDom.paginationRetryButton.hidden = false;

    } finally {
        if (generation === dashboardState.loadGeneration) {
            dashboardState.isLoadingMore = false;
            if (!dashboardState.paginationFailed) setupSessionsPaginationObserver();
        }
    }
}

/** Load period data and sessions while ignoring superseded results. */
export async function loadDashboard(feedbackStartedAt: number | null = null): Promise<void> {
    const generation = ++dashboardState.loadGeneration;
    const period = dashboardState.period;
    const anchorDate = dashboardState.anchorDates[period];
    dashboardState.isLoading = true;
    dashboardState.isLoadingMore = false;
    dashboardState.paginationFailed = false;
    dashboardDom.paginationMessage.textContent = '';
    dashboardDom.paginationRetryButton.hidden = true;
    dashboardState.sessionObserver?.disconnect();
    dashboardDom.sessionsLoadSentinel.style.display = 'none';
    renderSelectedDashboardPeriod();
    if (feedbackStartedAt === null) showDashboardLoading();

    try {
        const [
            dashboardResult,
            sessionsResult
        ] = await Promise.all([
            fetchDashboardData(
                period,
                anchorDate
            ),
            fetchSessionsPage(
                period,
                anchorDate
            )
        ]);

        if (feedbackStartedAt !== null) await waitForMinimumFeedback(feedbackStartedAt);
        if (generation !== dashboardState.loadGeneration) return;

        if (!dashboardResult.success) {
            throw new Error(dashboardResult.error);
        }

        if (!sessionsResult.success) {
            throw new Error(sessionsResult.error);
        }

        dashboardState.data = dashboardResult;

        dashboardState.sessions =
            sessionsResult.sessions;
        
        dashboardState.dailySummaries =
            sessionsResult.daily_summaries;

        dashboardState.nextCursor =
            sessionsResult.next_cursor;

        if (
            period !== 'all_time'
            && dashboardResult.period.start_date
        ) {
            dashboardState.anchorDates[period] =
                dashboardResult.period.start_date;
        }

        dashboardState.isLoading = false;
        dashboardDom.error.style.display = 'none';
        renderDashboardData();
        hideDashboardLoading();

        await loadStreak('dashboard');

    } catch (error) {
        if (feedbackStartedAt !== null) await waitForMinimumFeedback(feedbackStartedAt);
        if (generation !== dashboardState.loadGeneration) return;
        console.error(
            'Dashboard loading error:',
            error
        );
        showDashboardError();

    } finally {
        if (generation === dashboardState.loadGeneration) {
            dashboardState.isLoading = false;
            hideDashboardLoading();
        }
    }
}

/** Open Dashboard from Plan and load its data. */
async function handleOpenDashboard(): Promise<void> {
    navigateTo('dashboard', 'plan');
    await loadDashboard();
}

/** Return from Dashboard to mission planning. */
function handleDashboardToPlan(): void {
    navigateTo('plan', 'dashboard');
    if (feedbackDom.form.style.display === 'flex') closeFeedbackForm();
}

/** Report whether a string is a Dashboard period. */
function isDashboardPeriod(value: string | undefined): value is DashboardPeriod {
    return value === 'week' || value === 'month' || value === 'year' || value === 'all_time';
}

/** Select a Dashboard period and reload its data. */
async function handleDashboardPeriodChange(event: MouseEvent): Promise<void> {
    const button = closestElement(
        event.target,
        '[data-dashboard-period]',
        HTMLElement
    );

    if (!button) return;

    const newPeriod = button.dataset.dashboardPeriod;
    if (!isDashboardPeriod(newPeriod)) return;

    dashboardState.period = newPeriod;
    initializeDashboardState();

    await loadDashboard();
}

/** Move to the adjacent Dashboard period and reload its data. */
async function handleDashboardPeriodNavigation(direction: number): Promise<void> {
    if (dashboardState.period === 'all_time') return;

    dashboardState.anchorDates[dashboardState.period] = shiftPeriodAnchor(
        dashboardState.period,
        dashboardState.anchorDates[dashboardState.period],
        direction
    );

    await loadDashboard();
}

/** Report whether a string is a trend metric. */
function isDashboardMetric(value: string | undefined): value is DashboardMetric {
    return value === 'time' || value === 'sessions' || value === 'completion';
}

/** Select a trend metric and redraw the chart. */
function handleDashboardMetricChange(event: MouseEvent): void {
    const button = closestElement(
        event.target,
        '[data-dashboard-metric]',
        HTMLElement
    );

    if (!button) return;

    const newMetric = button.dataset.dashboardMetric;
    if (!isDashboardMetric(newMetric)) return;

    dashboardState.metric = newMetric;

    renderTrendMetricButtons();
    renderTrendChart();
}

/** Stop Dashboard loading and pagination when the user leaves the Dashboard. */
export function leaveDashboardScreen(): void {
    dashboardState.loadGeneration += 1;
    dashboardState.isLoading = false;
    dashboardState.isLoadingMore = false;
    dashboardState.sessionObserver?.disconnect();
}

/** Connect the Dashboard controls. */
export function initDashboard(): void {
    window.addEventListener('scroll', updateBackToStatsButton, { passive: true });
    window.addEventListener('resize', updateBackToStatsButton);
    dashboardDom.backToStatsButton.addEventListener('click', handleBackToStats);
    planDom.dashboardButton.addEventListener('click', handleOpenDashboard);
    dashboardDom.periodButtons.forEach(/** Attach a period selection handler. */ (button) => {
        button.addEventListener('click', handleDashboardPeriodChange);
    });
    dashboardDom.previousPeriodButton.addEventListener('click', /** Show the previous Dashboard period. */ () => handleDashboardPeriodNavigation(-1));
    dashboardDom.nextPeriodButton.addEventListener('click', /** Show the next Dashboard period. */ () => handleDashboardPeriodNavigation(1));
    dashboardDom.metricButtons.forEach(/** Attach a trend metric selection handler. */ (button) => {
        button.addEventListener('click', handleDashboardMetricChange);
    });
    dashboardDom.paginationRetryButton.addEventListener('click', /** Retry the failed history page request. */ () => {
        if (dashboardState.isLoading || dashboardState.isLoadingMore) return;
        dashboardState.paginationFailed = false;
        loadMoreSessions();
    });
    dashboardDom.retryButton.addEventListener('click', /** Retry queued saves and Dashboard loading with minimum feedback duration. */ async () => {
        if (dashboardState.isLoading || dashboardDom.retryButton.disabled) return;
        const feedbackStartedAt = performance.now();
        dashboardDom.retryButton.disabled = true;
        dashboardDom.retryButton.textContent = 'Retrying…';
        try {
            await Promise.all([syncOfflineWork(), loadDashboard(feedbackStartedAt)]);
        } finally {
            await waitForMinimumFeedback(feedbackStartedAt);
            dashboardDom.retryButton.disabled = false;
            dashboardDom.retryButton.textContent = 'Retry';
        }
    });
    dashboardDom.newMissionButton.addEventListener('click', handleDashboardToPlan);
    dashboardDom.emptyStartButton.addEventListener('click', handleDashboardToPlan);
    dashboardDom.sessionsList.addEventListener('click', toggleSessionMenu);
    document.addEventListener('click', closeSessionMenusOnOutsideClick);
    dashboardDom.sessionsList.addEventListener('click', /** Delete a Dashboard session and reload the Dashboard. */ (event) => handleDeleteSession(event, 'dashboard', loadDashboard));
}
