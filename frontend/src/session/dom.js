// Elements of the Plan, Focus and Review screens.

/** Elements of the Plan screen. */
export const planDom = {
    screen: document.querySelector('.plan-screen'),
    streakButton: document.getElementById('plan-streak-btn'),
    streakPopup: document.getElementById('plan-streak-popup'),
    userIcon: document.getElementById('plan-user-icon'),
    userMenu: document.getElementById('plan-user-menu'),
    username: document.getElementById('plan-user-menu-username'),
    logoutButton: document.getElementById('plan-user-menu-logout-btn'),
    mission: document.getElementById('plan-mission-input'),
    missionError: document.getElementById('plan-mission-error'),
    targetTime: document.getElementById('plan-target-time-input'),
    timeError: document.getElementById('plan-time-error'),
    dashboardButton: document.getElementById('plan-dashboard-btn'),
    roomsButton: document.getElementById('plan-rooms-btn'),
    startButton: document.getElementById('plan-start-work-btn')
};

/** Elements of the Focus screen. */
export const focusDom = {
    screen: document.querySelector('.focus-screen'),
    timerRing: document.getElementById('focus-timer-ring-container'),
    mission: document.getElementById('focus-mission-display'),
    targetTime: document.getElementById('focus-target-time-display'),
    currentTime: document.getElementById('focus-current-time-display'),
    pauseButton: document.getElementById('focus-pause-btn'),
    stopButton: document.getElementById('focus-stop-btn'),
    roomName: document.getElementById('focus-room-name-display')
};

/** Elements of the Review screen. */
export const reviewDom = {
    screen: document.querySelector('.review-screen'),
    mission: document.getElementById('review-mission-display'),
    targetTime: document.getElementById('review-target-time-display'),
    progressRing: document.getElementById('review-progress-ring-container'),
    percentage: document.getElementById('review-completion-percentage-display'),
    status: document.getElementById('review-completion-status-display'),
    actualTime: document.getElementById('review-actual-time-display'),
    continueButton: document.getElementById('review-continue-btn'),
    finishButton: document.getElementById('review-finish-btn'),
    saveMessage: document.getElementById('review-save-message'),
    wordmark: document.querySelector('.review-screen .wordmark'),
    roomName: document.getElementById('review-room-name'),
    roomSummary: document.getElementById('review-room-summary'),
    roomTotalTime: document.getElementById('review-room-total-time'),
    roomSessionCount: document.getElementById('review-room-session-count'),
    roomPeopleCount: document.getElementById('review-room-people-count'),
    roomAverageTime: document.getElementById('review-room-average-time')
};
