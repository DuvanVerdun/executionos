// Elements of the Rooms screen, the Room screen and the Room modals.

/** Elements of the Rooms screen. */
export const roomsDom = {
    screen: document.querySelector('.rooms-screen'),
    newMissionButton: document.getElementById('rooms-new-mission-btn'),
    dashboardButton: document.getElementById('rooms-dashboard-btn'),
    streakButton: document.getElementById('rooms-streak-btn'),
    streakPopup: document.getElementById('rooms-streak-popup'),
    userIcon: document.getElementById('rooms-user-icon'),
    userMenu: document.getElementById('rooms-user-menu'),
    username: document.getElementById('rooms-user-menu-username'),
    logoutButton: document.getElementById('rooms-user-menu-logout-btn'),
    createButton: document.getElementById('rooms-create-btn'),
    joinButton: document.getElementById('rooms-join-btn'),
    loading: document.getElementById('rooms-loading'),
    grid: document.getElementById('rooms-grid'),
    empty: document.getElementById('rooms-empty'),
    emptyCreateButton: document.getElementById('rooms-empty-create-btn'),
    error: document.getElementById('rooms-error'),
    retryButton: document.getElementById('rooms-retry-btn')
};

/** Elements of the Room screen. */
export const roomDom = {
    screen: document.querySelector('.room-screen'),
    backButton: document.getElementById('room-back-btn'),
    title: document.getElementById('room-title'),
    titleSkeleton: document.getElementById('room-title-skeleton'),
    menuWrapper: document.getElementById('room-menu-wrapper'),
    menuButton: document.getElementById('room-menu-btn'),
    menu: document.getElementById('room-menu'),
    loading: document.getElementById('room-loading'),
    data: document.getElementById('room-data'),
    error: document.getElementById('room-error'),
    retryButton: document.getElementById('room-retry-btn'),
    unavailable: document.getElementById('room-unavailable'),
    unavailableBackButton: document.getElementById('room-unavailable-back-btn'),
    totalTime: document.getElementById('room-total-time'),
    sessionCount: document.getElementById('room-session-count'),
    peopleCount: document.getElementById('room-people-count'),
    averageTime: document.getElementById('room-average-time'),
    beatButton: document.getElementById('room-beat-btn'),
    mission: document.getElementById('room-mission-input'),
    missionError: document.getElementById('room-mission-error'),
    targetTime: document.getElementById('room-target-time-input'),
    timeError: document.getElementById('room-time-error'),
    startButton: document.getElementById('room-start-work-btn'),
    startError: document.getElementById('room-start-error'),
    rankingTitle: document.getElementById('room-ranking-title'),
    ranking: document.getElementById('room-ranking'),
    history: document.getElementById('room-history'),
    historyEmpty: document.getElementById('room-history-empty'),
    historySentinel: document.getElementById('room-history-sentinel'),
    historyMessage: document.getElementById('room-history-message'),
    historyRetryButton: document.getElementById('room-history-retry-btn')
};

/** Elements of the Room modals: create, created, join and check-in. */
export const modalsDom = {
    create: {
        overlay: document.getElementById('create-room-overlay'),
        form: document.getElementById('create-room-form'),
        closeButton: document.getElementById('create-room-close-btn'),
        input: document.getElementById('create-room-input'),
        error: document.getElementById('create-room-error'),
        submitButton: document.getElementById('create-room-submit-btn')
    },
    created: {
        overlay: document.getElementById('room-created-overlay'),
        closeButton: document.getElementById('room-created-close-btn'),
        link: document.getElementById('room-created-link'),
        copyButton: document.getElementById('room-created-copy-btn')
    },
    join: {
        overlay: document.getElementById('join-room-overlay'),
        form: document.getElementById('join-room-form'),
        closeButton: document.getElementById('join-room-close-btn'),
        input: document.getElementById('join-room-input'),
        error: document.getElementById('join-room-error'),
        submitButton: document.getElementById('join-room-submit-btn')
    },
    checkin: {
        overlay: document.getElementById('checkin-overlay'),
        countdown: document.getElementById('checkin-countdown'),
        confirmButton: document.getElementById('checkin-confirm-btn'),
        error: document.getElementById('checkin-error')
    }
};
