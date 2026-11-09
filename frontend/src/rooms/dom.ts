// Elements of the Rooms screen, the Room screen and the Room modals.

import { getById, getElement } from '../lib/dom';

/** Elements of the Rooms screen. */
export const roomsDom = {
    screen: getElement('.rooms-screen', HTMLDivElement),
    newMissionButton: getById('rooms-new-mission-btn', HTMLButtonElement),
    dashboardButton: getById('rooms-dashboard-btn', HTMLButtonElement),
    streakButton: getById('rooms-streak-btn', HTMLButtonElement),
    streakPopup: getById('rooms-streak-popup', HTMLDivElement),
    userIcon: getById('rooms-user-icon', SVGSVGElement),
    userMenu: getById('rooms-user-menu', HTMLDivElement),
    username: getById('rooms-user-menu-username', HTMLParagraphElement),
    logoutButton: getById('rooms-user-menu-logout-btn', HTMLButtonElement),
    createButton: getById('rooms-create-btn', HTMLButtonElement),
    joinButton: getById('rooms-join-btn', HTMLButtonElement),
    loading: getById('rooms-loading', HTMLDivElement),
    grid: getById('rooms-grid', HTMLDivElement),
    empty: getById('rooms-empty', HTMLDivElement),
    emptyCreateButton: getById('rooms-empty-create-btn', HTMLButtonElement),
    error: getById('rooms-error', HTMLDivElement),
    retryButton: getById('rooms-retry-btn', HTMLButtonElement)
};

/** Elements of the Room screen. */
export const roomDom = {
    screen: getElement('.room-screen', HTMLDivElement),
    backButton: getById('room-back-btn', HTMLButtonElement),
    title: getById('room-title', HTMLHeadingElement),
    titleSkeleton: getById('room-title-skeleton', HTMLDivElement),
    menuWrapper: getById('room-menu-wrapper', HTMLDivElement),
    menuButton: getById('room-menu-btn', HTMLButtonElement),
    menu: getById('room-menu', HTMLDivElement),
    loading: getById('room-loading', HTMLDivElement),
    data: getById('room-data', HTMLDivElement),
    error: getById('room-error', HTMLDivElement),
    retryButton: getById('room-retry-btn', HTMLButtonElement),
    unavailable: getById('room-unavailable', HTMLDivElement),
    unavailableBackButton: getById('room-unavailable-back-btn', HTMLButtonElement),
    totalTime: getById('room-total-time', HTMLParagraphElement),
    sessionCount: getById('room-session-count', HTMLParagraphElement),
    peopleCount: getById('room-people-count', HTMLParagraphElement),
    averageTime: getById('room-average-time', HTMLParagraphElement),
    beatButton: getById('room-beat-btn', HTMLButtonElement),
    mission: getById('room-mission-input', HTMLInputElement),
    missionError: getById('room-mission-error', HTMLParagraphElement),
    targetTime: getById('room-target-time-input', HTMLInputElement),
    timeError: getById('room-time-error', HTMLParagraphElement),
    startButton: getById('room-start-work-btn', HTMLButtonElement),
    startError: getById('room-start-error', HTMLParagraphElement),
    rankingTitle: getById('room-ranking-title', HTMLHeadingElement),
    ranking: getById('room-ranking', HTMLDivElement),
    history: getById('room-history', HTMLDivElement),
    historyEmpty: getById('room-history-empty', HTMLDivElement),
    historySentinel: getById('room-history-sentinel', HTMLDivElement),
    historyMessage: getById('room-history-message', HTMLParagraphElement),
    historyRetryButton: getById('room-history-retry-btn', HTMLButtonElement)
};

/** Elements of the Room modals: create, created, join and check-in. */
export const modalsDom = {
    create: {
        overlay: getById('create-room-overlay', HTMLDivElement),
        form: getById('create-room-form', HTMLFormElement),
        closeButton: getById('create-room-close-btn', HTMLButtonElement),
        input: getById('create-room-input', HTMLInputElement),
        error: getById('create-room-error', HTMLParagraphElement),
        submitButton: getById('create-room-submit-btn', HTMLButtonElement)
    },
    created: {
        overlay: getById('room-created-overlay', HTMLDivElement),
        closeButton: getById('room-created-close-btn', HTMLButtonElement),
        link: getById('room-created-link', HTMLInputElement),
        copyButton: getById('room-created-copy-btn', HTMLButtonElement)
    },
    join: {
        overlay: getById('join-room-overlay', HTMLDivElement),
        form: getById('join-room-form', HTMLFormElement),
        closeButton: getById('join-room-close-btn', HTMLButtonElement),
        input: getById('join-room-input', HTMLInputElement),
        error: getById('join-room-error', HTMLParagraphElement),
        submitButton: getById('join-room-submit-btn', HTMLButtonElement)
    },
    checkin: {
        overlay: getById('checkin-overlay', HTMLDivElement),
        countdown: getById('checkin-countdown', HTMLParagraphElement),
        confirmButton: getById('checkin-confirm-btn', HTMLButtonElement),
        error: getById('checkin-error', HTMLParagraphElement)
    }
};
