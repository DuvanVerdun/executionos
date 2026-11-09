// Elements of the Plan, Focus and Review screens.

import { getById, getElement } from '../lib/dom';

/** Elements of the Plan screen. */
export const planDom = {
    screen: getElement('.plan-screen', HTMLDivElement),
    streakButton: getById('plan-streak-btn', HTMLButtonElement),
    streakPopup: getById('plan-streak-popup', HTMLDivElement),
    userIcon: getById('plan-user-icon', SVGSVGElement),
    userMenu: getById('plan-user-menu', HTMLDivElement),
    username: getById('plan-user-menu-username', HTMLParagraphElement),
    logoutButton: getById('plan-user-menu-logout-btn', HTMLButtonElement),
    mission: getById('plan-mission-input', HTMLInputElement),
    missionError: getById('plan-mission-error', HTMLParagraphElement),
    targetTime: getById('plan-target-time-input', HTMLInputElement),
    timeError: getById('plan-time-error', HTMLParagraphElement),
    dashboardButton: getById('plan-dashboard-btn', HTMLButtonElement),
    roomsButton: getById('plan-rooms-btn', HTMLButtonElement),
    startButton: getById('plan-start-work-btn', HTMLButtonElement)
};

/** Elements of the Focus screen. */
export const focusDom = {
    screen: getElement('.focus-screen', HTMLDivElement),
    timerRing: getById('focus-timer-ring-container', HTMLDivElement),
    mission: getById('focus-mission-display', HTMLParagraphElement),
    targetTime: getById('focus-target-time-display', HTMLParagraphElement),
    currentTime: getById('focus-current-time-display', HTMLParagraphElement),
    pauseButton: getById('focus-pause-btn', HTMLButtonElement),
    stopButton: getById('focus-stop-btn', HTMLButtonElement),
    roomName: getById('focus-room-name-display', HTMLParagraphElement)
};

/** Elements of the Review screen. */
export const reviewDom = {
    screen: getElement('.review-screen', HTMLDivElement),
    mission: getById('review-mission-display', HTMLParagraphElement),
    targetTime: getById('review-target-time-display', HTMLParagraphElement),
    progressRing: getById('review-progress-ring-container', HTMLDivElement),
    percentage: getById('review-completion-percentage-display', HTMLParagraphElement),
    status: getById('review-completion-status-display', HTMLParagraphElement),
    actualTime: getById('review-actual-time-display', HTMLParagraphElement),
    continueButton: getById('review-continue-btn', HTMLButtonElement),
    finishButton: getById('review-finish-btn', HTMLButtonElement),
    saveMessage: getById('review-save-message', HTMLParagraphElement),
    wordmark: getElement('.review-screen .wordmark', HTMLHeadingElement),
    roomName: getById('review-room-name', HTMLHeadingElement),
    roomSummary: getById('review-room-summary', HTMLDivElement),
    roomTotalTime: getById('review-room-total-time', HTMLParagraphElement),
    roomSessionCount: getById('review-room-session-count', HTMLParagraphElement),
    roomPeopleCount: getById('review-room-people-count', HTMLParagraphElement),
    roomAverageTime: getById('review-room-average-time', HTMLParagraphElement)
};
