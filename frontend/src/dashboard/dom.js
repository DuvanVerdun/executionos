// Elements of the Dashboard screen.

/** Elements of the Dashboard screen. */
export const dashboardDom = {
    screen: document.querySelector('.dashboard-screen'),
    backToStatsButton: document.getElementById('dashboard-back-to-stats-btn'),
    newMissionButton: document.getElementById('dashboard-new-mission-btn'),
    roomsButton: document.getElementById('dashboard-rooms-btn'),
    streakButton: document.getElementById('dashboard-streak-btn'),
    streakPopup: document.getElementById('dashboard-streak-popup'),
    userIcon: document.getElementById('dashboard-user-icon'),
    userMenu: document.getElementById('dashboard-user-menu'),
    username: document.getElementById('dashboard-user-menu-username'),
    logoutButton: document.getElementById('dashboard-user-menu-logout-btn'),
    loading: document.getElementById('dashboard-loading'),
    error: document.getElementById('dashboard-error'),
    retryButton: document.getElementById('dashboard-retry-btn'),
    dataContainer: document.getElementById('dashboard-data-container'),

    periodButtons: document.querySelectorAll('[data-dashboard-period]'),
    periodNavigation: document.querySelector('.dashboard-period-navigation'),
    previousPeriodButton: document.getElementById('dashboard-previous-period-btn'),
    nextPeriodButton: document.getElementById('dashboard-next-period-btn'),
    periodLabel: document.getElementById('dashboard-period-label'),
    averageSessionTime: document.getElementById('dashboard-average-session-time-display'),
    metricButtons: document.querySelectorAll('[data-dashboard-metric]'),
    trendChart: document.getElementById('dashboard-trend-chart'),
    sessionsLoadSentinel: document.getElementById('dashboard-sessions-load-sentinel'),
    paginationMessage: document.getElementById('dashboard-pagination-message'),
    paginationRetryButton: document.getElementById('dashboard-pagination-retry-btn'),

    summaryContainer: document.getElementById('dashboard-summary-container'),
    sessionCount: document.getElementById('dashboard-amount-of-sessions-display'),
    averagePercentage: document.getElementById('dashboard-average-percentage-display'),
    totalTime: document.getElementById('dashboard-total-time-display'),
    sessionsList: document.getElementById('dashboard-sessions-list-container'),
    emptyCTA: document.getElementById('empty-dashboard-cta-container'),
    emptyStartButton: document.getElementById('empty-dashboard-start-mission-btn')
};
