// Elements of the Dashboard screen.

import { getAllElements, getById, getElement } from '../lib/dom';

/** Elements of the Dashboard screen. */
export const dashboardDom = {
    screen: getElement('.dashboard-screen', HTMLDivElement),
    backToStatsButton: getById('dashboard-back-to-stats-btn', HTMLButtonElement),
    newMissionButton: getById('dashboard-new-mission-btn', HTMLButtonElement),
    roomsButton: getById('dashboard-rooms-btn', HTMLButtonElement),
    streakButton: getById('dashboard-streak-btn', HTMLButtonElement),
    streakPopup: getById('dashboard-streak-popup', HTMLDivElement),
    userIcon: getById('dashboard-user-icon', SVGSVGElement),
    userMenu: getById('dashboard-user-menu', HTMLDivElement),
    username: getById('dashboard-user-menu-username', HTMLParagraphElement),
    logoutButton: getById('dashboard-user-menu-logout-btn', HTMLButtonElement),
    loading: getById('dashboard-loading', HTMLDivElement),
    error: getById('dashboard-error', HTMLDivElement),
    retryButton: getById('dashboard-retry-btn', HTMLButtonElement),
    dataContainer: getById('dashboard-data-container', HTMLDivElement),

    periodButtons: getAllElements('[data-dashboard-period]', HTMLButtonElement),
    periodNavigation: getElement('.dashboard-period-navigation', HTMLDivElement),
    previousPeriodButton: getById('dashboard-previous-period-btn', HTMLButtonElement),
    nextPeriodButton: getById('dashboard-next-period-btn', HTMLButtonElement),
    periodLabel: getById('dashboard-period-label', HTMLParagraphElement),
    averageSessionTime: getById('dashboard-average-session-time-display', HTMLParagraphElement),
    metricButtons: getAllElements('[data-dashboard-metric]', HTMLButtonElement),
    trendChart: getById('dashboard-trend-chart', SVGSVGElement),
    sessionsLoadSentinel: getById('dashboard-sessions-load-sentinel', HTMLDivElement),
    paginationMessage: getById('dashboard-pagination-message', HTMLParagraphElement),
    paginationRetryButton: getById('dashboard-pagination-retry-btn', HTMLButtonElement),

    summaryContainer: getById('dashboard-summary-container', HTMLElement),
    sessionCount: getById('dashboard-amount-of-sessions-display', HTMLParagraphElement),
    averagePercentage: getById('dashboard-average-percentage-display', HTMLParagraphElement),
    totalTime: getById('dashboard-total-time-display', HTMLParagraphElement),
    sessionsList: getById('dashboard-sessions-list-container', HTMLDivElement),
    emptyCTA: getById('empty-dashboard-cta-container', HTMLDivElement),
    emptyStartButton: getById('empty-dashboard-start-mission-btn', HTMLButtonElement)
};
