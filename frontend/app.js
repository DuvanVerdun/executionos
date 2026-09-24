// ========== CONFIGURATION ==========

let BACKEND_URL = '';
if (window.location.hostname === 'executionos-mvp.netlify.app') {
    BACKEND_URL = 'https://executionos.onrender.com';
} else if (window.location.hostname === 'localhost') {
    BACKEND_URL = 'https://localhost:5000';
}

const MONTH_ABBREVIATIONS = {
    1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
    7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
};
const WEEKDAY_ABBREVIATIONS = {
    0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'
};
const ACTIVE_SESSION_STORAGE_KEY = 'executionOS_activeSession';


// ========== STATE ==========

let accessToken = null;
let isUserMenuOpened = false;
let timerInterval = null;

const activeSessionState = {
    currentMission: '',
    targetTimeSeconds: 0,
    actualTimeSeconds: 0,
    completionStatus: 'partial',
    percentageCompleted: 0,
    isTimerRunning: false,
    startTimestamp: '',
    pauseStartTimestamp: '',
    pausedTimeSeconds: 0
};

const sessionQueue = {
    items: [],
    cap: 15,
    storageKey: 'executionOS_sessionQueue',

    load() {
        const stored = localStorage.getItem(this.storageKey);
        this.items = stored ? JSON.parse(stored) : [];
    },
    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    },
    add(item) {
        if (this.items.length >= this.cap) return false;
        this.items.push(item);
        this.save();
        return true;
    },
    removeFirst() {
        this.items.shift();
        this.save();
    }
};


// ========== DOM REFERENCES ==========

const dom = {
    loading: {
        screen: document.querySelector('.loading-screen'),
        spinner: document.getElementById('loading-spinner-container'),
        error: document.getElementById('loading-error-message'),
        retryButton: document.getElementById('loading-retry-btn')
    },
    register: {
        screen: document.querySelector('.register-screen'),
        form: document.getElementById('register-form'),
        username: document.getElementById('register-username-input'),
        email: document.getElementById('register-email-input'),
        password: document.getElementById('register-password-input'),
        passwordError: document.getElementById('register-password-error-message'),
        submitButton: document.getElementById('register-submit-btn'),
        error: document.getElementById('register-error-message'),
        switchToLoginButton: document.getElementById('register-switch-to-login-btn')
    },
    login: {
        screen: document.querySelector('.login-screen'),
        form: document.getElementById('login-form'),
        usernameOrEmail: document.getElementById('login-username-or-email-input'),
        password: document.getElementById('login-password-input'),
        submitButton: document.getElementById('login-submit-btn'),
        error: document.getElementById('login-error-message'),
        switchToRegisterButton: document.getElementById('login-switch-to-register-btn')
    },
    plan: {
        screen: document.querySelector('.plan-screen'),
        userIcon: document.getElementById('plan-user-icon'),
        userMenu: document.getElementById('plan-user-menu'),
        username: document.getElementById('plan-user-menu-username'),
        menuIcon: document.getElementById('plan-user-menu-icon'),
        logoutButton: document.getElementById('plan-user-menu-logout-btn'),
        mission: document.getElementById('plan-mission-input'),
        targetTime: document.getElementById('plan-target-time-input'),
        dashboardButton: document.getElementById('plan-dashboard-btn'),
        startButton: document.getElementById('plan-start-work-btn')
    },
    focus: {
        screen: document.querySelector('.focus-screen'),
        timerRing: document.getElementById('focus-timer-ring-container'),
        mission: document.getElementById('focus-mission-display'),
        targetTime: document.getElementById('focus-target-time-display'),
        currentTime: document.getElementById('focus-current-time-display'),
        pauseButton: document.getElementById('focus-pause-btn'),
        stopButton: document.getElementById('focus-stop-btn')
    },
    review: {
        screen: document.querySelector('.review-screen'),
        mission: document.getElementById('review-mission-display'),
        targetTime: document.getElementById('review-target-time-display'),
        progressRing: document.getElementById('review-progress-ring-container'),
        percentage: document.getElementById('review-completion-percentage-display'),
        status: document.getElementById('review-completion-status-display'),
        actualTime: document.getElementById('review-actual-time-display'),
        continueButton: document.getElementById('review-continue-btn'),
        finishButton: document.getElementById('review-finish-btn')
    },
    dashboard: {
        screen: document.querySelector('.dashboard-screen'),
        newMissionButton: document.getElementById('dashboard-new-mission-btn'),
        userIcon: document.getElementById('dashboard-user-icon'),
        userMenu: document.getElementById('dashboard-user-menu'),
        username: document.getElementById('dashboard-user-menu-username'),
        menuIcon: document.getElementById('dashboard-user-menu-icon'),
        logoutButton: document.getElementById('dashboard-user-menu-logout-btn'),
        content: document.getElementById('dashboard-content'),
        loading: document.getElementById('dashboard-loading'),
        weeklyStats: document.getElementById('dashboard-weekly-stats-container'),
        sessionCount: document.getElementById('dashboard-amount-of-sessions-display'),
        averagePercentage: document.getElementById('dashboard-average-percentage-display'),
        totalTime: document.getElementById('dashboard-total-time-display'),
        sessionsList: document.getElementById('dashboard-sessions-list-container'),
        emptyCTA: document.getElementById('empty-dashboard-cta-container'),
        emptyStartButton: document.getElementById('empty-dashboard-start-mission-btn'),
        openFeedbackButton: document.getElementById('dashboard-open-feedback-form-btn'),
        feedbackForm: document.getElementById('dashboard-feedback-form'),
        closeFeedbackButton: document.getElementById('dashboard-close-feedback-form-btn'),
        feedbackInput: document.getElementById('dashboard-feedback-input'),
        sendFeedbackButton: document.getElementById('dashboard-send-feedback-btn')
    },
    passwordButtons: document.querySelectorAll('.password-visibility-btn')
};


// ========== DURATION AND SESSION DOMAIN ==========

function parseHHMMToSeconds(timeString) {
    const [hours, minutes] = timeString.split(':');
    return parseInt(hours) * 3600 + parseInt(minutes) * 60;
}

function formatDuration(totalSeconds) {
    const hours = Math.floor(Number(totalSeconds) / 3600);
    const minutes = Math.floor((Number(totalSeconds) % 3600) / 60);
    const seconds = Number(totalSeconds) % 60;
    if (hours >= 1) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (minutes >= 1) return `${minutes}:${String(seconds).padStart(2, '0')}`;
    return seconds;
}

function formatDurationHoursMinutes(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours >= 1) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function formatDurationHoursMinutesSeconds(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    if (hours >= 1) {
        if (seconds >= 1) return `${hours}h ${minutes}m ${seconds}s`;
        return `${hours}h ${minutes}m`;
    }
    if (minutes >= 1) {
        if (seconds >= 1) return `${minutes}m ${seconds}s`;
        return `${minutes}m`;
    }
    return `${seconds} sec`;
}

function updateElapsedSessionTime(session) {
    if (session.pauseStartTimestamp) {
        const elapsed = (Date.now() - new Date(session.pauseStartTimestamp).getTime()) / 1000;
        session.pausedTimeSeconds += elapsed;
        session.pauseStartTimestamp = '';
    }
    session.actualTimeSeconds = Math.floor(
        (Date.now() - new Date(session.startTimestamp).getTime()) / 1000 - session.pausedTimeSeconds
    );
    const exactPercentage = session.actualTimeSeconds / session.targetTimeSeconds * 100;
    session.percentageCompleted = Math.floor(exactPercentage);
    return exactPercentage;
}

function startTimer(session) {
    session.isTimerRunning = true;
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    if (!activeSessionState.isTimerRunning) return;
    const exactPercentage = updateElapsedSessionTime(activeSessionState);
    renderFocusTimer(activeSessionState, exactPercentage);
    saveActiveSession(activeSessionState);
}

function pauseSession(session) {
    clearInterval(timerInterval);
    session.isTimerRunning = false;
    session.pauseStartTimestamp = new Date();
}

function resumeSession(session) {
    const elapsed = (Date.now() - new Date(session.pauseStartTimestamp).getTime()) / 1000;
    session.pausedTimeSeconds += elapsed;
    session.pauseStartTimestamp = '';
    startTimer(session);
}

function stopSession(session) {
    clearInterval(timerInterval);
    session.isTimerRunning = false;
    const exactPercentage = updateElapsedSessionTime(session);
    renderFocusTimer(session, exactPercentage);
    if (session.actualTimeSeconds >= session.targetTimeSeconds) {
        session.completionStatus = 'completed';
    }
    if (!session.pauseStartTimestamp) {
        session.pauseStartTimestamp = new Date();
    }
}

function resetSessionState(session) {
    session.currentMission = '';
    session.targetTimeSeconds = 0;
    session.actualTimeSeconds = 0;
    session.completionStatus = 'partial';
    session.percentageCompleted = 0;
    session.isTimerRunning = false;
    session.startTimestamp = '';
    session.pauseStartTimestamp = '';
    session.pausedTimeSeconds = 0;
}

function getPasswordError(password) {
    if (password.length < 12) return 'At least 12 characters.';
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#\$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]).+$/;
    if (!regex.test(password)) return 'Must contain uppercase, lowercase, symbol, and number.';
    return '';
}


// ========== LOCAL PERSISTENCE AND OFFLINE QUEUE ==========

function saveActiveSession(session) {
    const activeSession = {
        mission: session.currentMission,
        targetTimeSeconds: session.targetTimeSeconds,
        actualTimeSeconds: session.actualTimeSeconds,
        startTimestamp: session.startTimestamp,
        pauseStartTimestamp: session.pauseStartTimestamp,
        pausedTimeSeconds: session.pausedTimeSeconds
    };
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(activeSession));
}

function loadActiveSession(session) {
    const stored = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!stored) return false;

    const activeSession = JSON.parse(stored);
    session.currentMission = activeSession.mission;
    session.targetTimeSeconds = activeSession.targetTimeSeconds;
    session.actualTimeSeconds = activeSession.actualTimeSeconds;
    session.startTimestamp = activeSession.startTimestamp;
    session.pauseStartTimestamp = activeSession.pauseStartTimestamp;
    session.pausedTimeSeconds = activeSession.pausedTimeSeconds;

    if (!session.pauseStartTimestamp) {
        const startTime = new Date(session.startTimestamp).getTime();
        const lastActiveTime = startTime + (session.actualTimeSeconds + session.pausedTimeSeconds) * 1000;
        session.pauseStartTimestamp = new Date(lastActiveTime).toISOString();
        saveActiveSession(session);
    }
    return true;
}

function clearActiveSession() {
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
}

async function retryQueue() {
    while (sessionQueue.items.length > 0) {
        try {
            const sessionData = sessionQueue.items[0];
            await postSession(sessionData);
            sessionQueue.removeFirst();
        } catch (error) {
            console.error('Retry failed:', error);
            break;
        }
    }
}

async function syncOfflineWork() {
    sessionQueue.load();
    if (sessionQueue.items.length > 0) {
        alert('Syncing offline work...');
        await retryQueue();
    }
}


// ========== API AND AUTHENTICATION TRANSPORT ==========

async function unauthFetch(options) {
    if (!options.path || !options.method) {
        throw new Error('Missing required options: path and method');
    }
    const response = await fetch(`${BACKEND_URL}/api/${options.path}`, {
        method: options.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body),
        credentials: 'include'
    });
    const result = await response.json();
    result.status = response.status;
    return result;
}

function register(username, email, password) {
    return unauthFetch({ path: 'register', method: 'POST', body: { username, email, password } });
}

function login(usernameOrEmail, password) {
    return unauthFetch({ path: 'login', method: 'POST', body: { usernameOrEmail, password } });
}

async function refreshAccessToken() {
    const response = await fetch(`${BACKEND_URL}/api/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    });
    if (response.status === 401 || response.status === 403) return '';

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Token refresh failed');
    return result;
}

function sendAuthenticatedRequest(options, token) {
    return fetch(`${BACKEND_URL}/api/${options.path}`, {
        method: options.method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(options.body)
    });
}

async function apiFetch(options) {
    if (!options.path || !options.method) {
        throw new Error('Missing required options: path and method');
    }
    const response = await sendAuthenticatedRequest(options, accessToken);
    if (response.status === 401) {
        const result = await refreshAccessToken();
        const retry = await sendAuthenticatedRequest(options, result.access_token);
        if (retry.status === 401) {
            navigateTo('login', options.currentScreen);
            throw new Error('Unauthorized: Please log in.');
        }
        const retryResult = await retry.json();
        retryResult.status = retry.status;
        setAuthenticatedUser(result);
        return retryResult;
    }
    const result = await response.json();
    result.status = response.status;
    return result;
}

function logout() {
    return apiFetch({ path: 'logout', method: 'POST' });
}

function postSession(sessionData) {
    return apiFetch({ path: 'save-session', method: 'POST', body: sessionData, currentScreen: 'review' });
}

async function getSessions(currentScreen) {
    const result = await apiFetch({ path: 'get-sessions', method: 'GET', currentScreen });
    return result.sessions;
}

function deleteSession(sessionId) {
    return apiFetch({ path: `delete-session/${sessionId}`, method: 'DELETE', currentScreen: 'dashboard' });
}

function postFeedback(feedbackMessage) {
    return apiFetch({ path: 'feedback', method: 'POST', body: { message: feedbackMessage }, currentScreen: 'dashboard' });
}


// ========== DASHBOARD DATA ==========

function getCurrentWeekRange() {
    const today = new Date();
    const firstDayOfTheWeek = new Date(today);
    const daysSinceMonday = (today.getDay() + 6) % 7;
    firstDayOfTheWeek.setDate(today.getDate() - daysSinceMonday);
    firstDayOfTheWeek.setHours(0, 0, 0, 0);
    return { today, firstDayOfTheWeek };
}

function filterCurrentWeekSessions(sessions, today, firstDayOfTheWeek) {
    const thisWeekSessions = [];
    for (const session of sessions) {
        const sessionDate = new Date(session.date + 'Z');
        if (sessionDate >= firstDayOfTheWeek && sessionDate <= today) {
            thisWeekSessions.push(session);
        }
    }
    thisWeekSessions.sort((a, b) => new Date(b.date + 'Z') - new Date(a.date + 'Z'));
    return thisWeekSessions;
}

function calculateWeeklyStats(sessions) {
    if (sessions.length === 0) {
        return { sessionCount: 0, averageCompletionPercentage: 0, totalTimeSeconds: 0 };
    }
    let totalCombinedPercentages = 0;
    let totalTimeSeconds = 0;
    for (const session of sessions) {
        totalCombinedPercentages += session.percentage_completed;
        totalTimeSeconds += session.actual_time_seconds;
    }
    return {
        sessionCount: sessions.length,
        averageCompletionPercentage: Math.round(totalCombinedPercentages / sessions.length),
        totalTimeSeconds
    };
}

function getDashboardData(sessions) {
    const { today, firstDayOfTheWeek } = getCurrentWeekRange();
    const thisWeekSessions = filterCurrentWeekSessions(sessions, today, firstDayOfTheWeek);
    return { sessions: thisWeekSessions, weeklyStats: calculateWeeklyStats(thisWeekSessions) };
}


// ========== SHARED UI PRESENTATION ==========

function setAuthenticatedUser(result) {
    accessToken = result.access_token;
    dom.plan.username.textContent = result.username;
    dom.dashboard.username.textContent = result.username;
}

function clearAuthenticatedUser() {
    accessToken = null;
    dom.plan.username.textContent = '';
    dom.dashboard.username.textContent = '';
}

function renderProgressRing(ring, percentage, beforeTargetColor, afterTargetColor) {
    if (percentage < 100) {
        ring.style.setProperty('--pct', `${percentage}%`);
        ring.style.background =
            `conic-gradient(${beforeTargetColor} 0%, ${beforeTargetColor} var(--pct), var(--border) var(--pct), var(--border) 100%)`;
    } else {
        ring.style.setProperty('--pct', `${percentage - 100}%`);
        ring.style.background =
            `conic-gradient(var(--white) 0%, var(--white) var(--pct), ${afterTargetColor} var(--pct), ${afterTargetColor} 100%)`;
    }
}

function renderFocusTimer(session, exactPercentage) {
    dom.focus.currentTime.textContent = formatDuration(session.actualTimeSeconds);
    renderProgressRing(dom.focus.timerRing, exactPercentage, 'var(--white)', 'var(--reward)');
}

function renderFocusSession(session) {
    dom.focus.mission.textContent = session.currentMission;
    dom.focus.targetTime.textContent = formatDuration(session.targetTimeSeconds);
    dom.focus.currentTime.textContent = formatDuration(session.actualTimeSeconds);
}

function renderReviewSession(session) {
    dom.review.mission.textContent = session.currentMission;
    dom.review.targetTime.textContent = formatDuration(session.targetTimeSeconds);
    dom.review.percentage.textContent = `${session.percentageCompleted}%`;
    dom.review.status.textContent =
        session.completionStatus.charAt(0).toUpperCase() + session.completionStatus.slice(1);
    dom.review.actualTime.textContent = formatDurationHoursMinutesSeconds(session.actualTimeSeconds);
    renderProgressRing(dom.review.progressRing, session.percentageCompleted, 'var(--cta)', 'var(--reward)');
    if (session.percentageCompleted >= 100) {
        dom.review.continueButton.classList.replace('cta-button', 'normal-button');
    }
}

function showLoadingScreenError() {
    dom.loading.spinner.style.display = 'none';
    dom.loading.error.style.display = 'flex';
    dom.loading.retryButton.style.display = 'flex';
}

function showLoadingSpinner() {
    dom.loading.spinner.style.display = 'flex';
    dom.loading.error.style.display = 'none';
    dom.loading.retryButton.style.display = 'none';
}

function setPasswordVisibility(passwordInput, visibilityButton, visible) {
    const showIcon = visibilityButton.querySelector('.password-show-icon');
    const hideIcon = visibilityButton.querySelector('.password-hide-icon');
    passwordInput.type = visible ? 'text' : 'password';
    showIcon.style.display = visible ? 'none' : 'block';
    hideIcon.style.display = visible ? 'block' : 'none';
    visibilityButton.ariaLabel = visible ? 'Hide password' : 'Show password';
}

function togglePasswordVisibility(passwordInput, visibilityButton) {
    setPasswordVisibility(passwordInput, visibilityButton, passwordInput.type === 'password');
}

function hidePassword(passwordInput) {
    const visibilityButton = passwordInput.parentElement.querySelector('.password-visibility-btn');
    setPasswordVisibility(passwordInput, visibilityButton, false);
}

function toggleUserMenu(screen) {
    const menu = dom[screen].userMenu;
    if (isUserMenuOpened) {
        menu.style.display = 'none';
        isUserMenuOpened = false;
        return;
    }
    menu.style.display = 'flex';
    isUserMenuOpened = true;
}

function closeUserMenusOnOutsideClick(event) {
    if (!isUserMenuOpened) return;
    const clickedInsidePlanMenu = dom.plan.userMenu.contains(event.target);
    const clickedPlanIcon = dom.plan.userIcon.contains(event.target);
    const clickedInsideDashboardMenu = dom.dashboard.userMenu.contains(event.target);
    const clickedDashboardIcon = dom.dashboard.userIcon.contains(event.target);
    if (clickedInsidePlanMenu || clickedPlanIcon || clickedInsideDashboardMenu || clickedDashboardIcon) return;
    dom.plan.userMenu.style.display = 'none';
    dom.dashboard.userMenu.style.display = 'none';
    isUserMenuOpened = false;
}


// ========== SCREEN NAVIGATION ==========

const SCREEN_DISPLAY = {
    loading: 'flex', register: 'grid', login: 'grid',
    plan: 'flex', focus: 'flex', review: 'grid', dashboard: 'flex'
};

const ALLOWED_SCREEN_TRANSITIONS = {
    register: ['loading', 'login'],
    login: ['register', 'plan', 'focus', 'review', 'dashboard'],
    plan: ['loading', 'register', 'login', 'dashboard'],
    focus: ['loading', 'plan', 'review'],
    review: ['focus'],
    dashboard: ['plan', 'review']
};

function navigateTo(nextScreen, currentScreen) {
    if (!ALLOWED_SCREEN_TRANSITIONS[nextScreen]?.includes(currentScreen)) return;
    if ((currentScreen === 'plan' || currentScreen === 'dashboard') && isUserMenuOpened) {
        toggleUserMenu(currentScreen);
    }
    if (currentScreen === 'loading' && nextScreen === 'register') {
        dom.loading.spinner.style.display = 'none';
    }
    if (nextScreen === 'focus' && currentScreen !== 'review') {
        renderFocusSession(activeSessionState);
    }
    if (nextScreen === 'focus' && currentScreen === 'loading') {
        dom.focus.pauseButton.textContent = 'Resume';
    }
    if (nextScreen === 'review') {
        renderReviewSession(activeSessionState);
    }
    dom[currentScreen].screen.style.display = 'none';
    dom[nextScreen].screen.style.display = SCREEN_DISPLAY[nextScreen];
}

function showDashboardLoading() {
    dom.dashboard.weeklyStats.style.display = 'none';
    dom.dashboard.sessionsList.style.display = 'none';
    dom.dashboard.emptyCTA.style.display = 'none';
    dom.dashboard.loading.style.display = 'flex';
}

function hideDashboardLoading() {
    dom.dashboard.loading.style.display = 'none';
}


// ========== DASHBOARD UI ==========

function createSessionListTitle() {
    const title = document.createElement('h2');
    title.className = 'dashboard-content-title';
    title.textContent = 'Sessions';
    return title;
}

function createSessionMissionSection(session) {
    const container = document.createElement('div');
    const missionIcon = document.createElement('span');
    const mission = document.createElement('p');
    const openMenuIcon = document.createElement('span');
    const menu = document.createElement('div');
    const closeMenuIcon = document.createElement('span');
    const deleteButton = document.createElement('button');

    container.className = 'dashboard-session-mission-container';
    missionIcon.className = 'material-symbols-outlined dashboard-session-mission-icon';
    mission.className = 'dashboard-session-mission';
    openMenuIcon.className = 'material-symbols-outlined dashboard-session-open-menu-icon dashboard-session-toggle-menu-icon';
    menu.className = 'dashboard-session-menu';
    closeMenuIcon.className = 'material-symbols-outlined dashboard-session-close-menu-icon dashboard-session-toggle-menu-icon';
    deleteButton.className = 'dashboard-delete-session-btn';

    missionIcon.textContent = 'assignment';
    mission.textContent = session.mission;
    openMenuIcon.textContent = 'more_vert';
    closeMenuIcon.textContent = 'more_vert';
    deleteButton.textContent = 'Delete Session';
    deleteButton.dataset.sessionId = session.id;

    container.append(missionIcon, mission, openMenuIcon, menu);
    menu.append(deleteButton, closeMenuIcon);
    return container;
}

function createSessionTimeSection(session) {
    const container = document.createElement('div');
    const timeIcon = document.createElement('span');
    const targetTime = document.createElement('p');
    const arrowIcon = document.createElement('span');
    const actualTime = document.createElement('p');
    const percentage = document.createElement('p');
    const checkIcon = document.createElement('span');

    container.className = 'dashboard-session-time-and-percentage-container';
    timeIcon.className = 'material-symbols-outlined dashboard-session-time-icon';
    targetTime.className = 'dashboard-session-target-time';
    arrowIcon.className = 'material-symbols-outlined dashboard-session-arrow-icon';
    actualTime.className = 'dashboard-session-actual-time';
    percentage.className = 'dashboard-session-percentage';
    checkIcon.className = 'material-symbols-outlined dashboard-session-check-icon';

    timeIcon.textContent = 'timer';
    targetTime.textContent = formatDurationHoursMinutes(session.target_time_seconds);
    arrowIcon.textContent = 'arrow_right_alt';
    actualTime.textContent = formatDurationHoursMinutes(session.actual_time_seconds);
    percentage.textContent = `${session.percentage_completed}%`;
    checkIcon.textContent = 'check';

    container.append(timeIcon, targetTime, arrowIcon, actualTime, percentage, checkIcon);
    return container;
}

function appendSessionToCard(session, card) {
    card.append(createSessionMissionSection(session), createSessionTimeSection(session));
}

function createSessionDateCard(session, uiDate, dateObject) {
    const card = document.createElement('div');
    const dateLabel = document.createElement('p');
    card.className = 'dashboard-session-card';
    card.id = `session-card-${dateObject.getMonth() + 1}-${dateObject.getDate()}`;
    dateLabel.className = 'dashboard-session-date';
    dateLabel.textContent = uiDate;
    card.appendChild(dateLabel);
    appendSessionToCard(session, card);
    return card;
}

function appendSessionToExistingCard(session, cardId) {
    const card = document.getElementById(cardId);
    const divider = document.createElement('span');
    divider.className = 'dashboard-session-division-line';
    card.appendChild(divider);
    appendSessionToCard(session, card);
}

function renderSessionsByDate(sessions) {
    let lastDate = '';
    for (const session of sessions) {
        const dateObject = new Date(session.date + 'Z');
        const weekday = WEEKDAY_ABBREVIATIONS[dateObject.getDay()];
        const month = MONTH_ABBREVIATIONS[dateObject.getMonth() + 1];
        const uiDate = `${weekday}, ${month} ${dateObject.getDate()}`;
        if (lastDate !== uiDate) {
            dom.dashboard.sessionsList.appendChild(createSessionDateCard(session, uiDate, dateObject));
        } else {
            const cardId = `session-card-${dateObject.getMonth() + 1}-${dateObject.getDate()}`;
            appendSessionToExistingCard(session, cardId);
        }
        lastDate = uiDate;
    }
}

function renderDashboardData(sessions) {
    const { sessions: weeklySessions, weeklyStats } = getDashboardData(sessions);
    if (weeklySessions.length === 0) {
        dom.dashboard.weeklyStats.style.display = 'none';
        dom.dashboard.sessionsList.style.display = 'none';
        dom.dashboard.emptyCTA.style.display = 'flex';
        return;
    }
    dom.dashboard.weeklyStats.style.display = 'flex';
    dom.dashboard.sessionsList.style.display = 'flex';
    dom.dashboard.emptyCTA.style.display = 'none';
    dom.dashboard.sessionsList.innerHTML = '';
    dom.dashboard.sessionsList.appendChild(createSessionListTitle());
    renderSessionsByDate(weeklySessions);
    dom.dashboard.sessionCount.textContent = `${weeklyStats.sessionCount} sessions`;
    dom.dashboard.averagePercentage.textContent = `${weeklyStats.averageCompletionPercentage}%`;
    dom.dashboard.totalTime.textContent = `${formatDurationHoursMinutes(weeklyStats.totalTimeSeconds)}`;
}

function openSessionMenu(event) {
    const openIcon = event.target.closest('.dashboard-session-open-menu-icon');
    if (!openIcon) return;
    const menu = openIcon.parentElement.querySelector('.dashboard-session-menu');
    openIcon.style.pointerEvents = 'none';
    menu.style.display = 'flex';
}

function closeSessionMenu(event) {
    const closeIcon = event.target.closest('.dashboard-session-close-menu-icon');
    if (!closeIcon) return;
    const menu = closeIcon.parentElement;
    const openIcon = menu.parentElement.querySelector('.dashboard-session-open-menu-icon');
    openIcon.style.pointerEvents = 'auto';
    menu.style.display = 'none';
}

function openFeedbackForm() {
    dom.dashboard.feedbackForm.style.display = 'flex';
}

function closeFeedbackForm() {
    dom.dashboard.feedbackForm.style.display = 'none';
}

function closeFeedbackFormOnOutsideClick(event) {
    if (dom.dashboard.feedbackForm.style.display !== 'flex') return;
    const clickedInsideForm = dom.dashboard.feedbackForm.contains(event.target);
    const clickedOpenButton = dom.dashboard.openFeedbackButton.contains(event.target);
    if (clickedInsideForm || clickedOpenButton) return;
    closeFeedbackForm();
}


// ========== APP WORKFLOWS ==========

async function initializeApp() {
    try {
        const result = await refreshAccessToken();
        setAuthenticatedUser(result);
    } catch (error) {
        showLoadingScreenError();
        return;
    }
    await routeToInitialScreen();
}

async function routeToInitialScreen() {
    if (!accessToken) {
        navigateTo('register', 'loading');
        return;
    }
    syncOfflineWork();
    const restoredSession = loadActiveSession(activeSessionState);
    if (!restoredSession) {
        navigateTo('plan', 'loading');
        return;
    }
    alert('Returning to uncompleted session...');
    navigateTo('focus', 'loading');
}

function validatePlan() {
    if (!dom.plan.mission.value) return 'Please enter a mission';
    if (dom.plan.mission.value.length > 50) return 'Mission must be 50 characters or less';
    if (!dom.plan.targetTime.value || !/^\d{2}:\d{2}$/.test(dom.plan.targetTime.value)) {
        return 'Please enter a target time in HH:MM format';
    }
    const [hours, minutes] = dom.plan.targetTime.value.split(':').map(Number);
    if (minutes > 59) return 'Minutes must be between 00 and 59';
    if (hours === 0 && minutes === 0) return 'Target time must be greater than 00:00';
    return '';
}

function handleStartWork() {
    const error = validatePlan();
    if (error) {
        alert(error);
        return;
    }
    activeSessionState.currentMission = dom.plan.mission.value;
    activeSessionState.targetTimeSeconds = parseHHMMToSeconds(dom.plan.targetTime.value);
    activeSessionState.startTimestamp = new Date().toISOString();
    navigateTo('focus', 'plan');
    startTimer(activeSessionState);
}

function handlePauseResume() {
    if (activeSessionState.isTimerRunning) {
        pauseSession(activeSessionState);
        dom.focus.pauseButton.textContent = 'Resume';
        saveActiveSession(activeSessionState);
    } else {
        dom.focus.pauseButton.textContent = 'Pause';
        resumeSession(activeSessionState);
    }
}

function handleStopWork() {
    stopSession(activeSessionState);
    navigateTo('review', 'focus');
}

function handleContinueWork() {
    navigateTo('focus', 'review');
    dom.focus.pauseButton.textContent = 'Pause';
    resumeSession(activeSessionState);
}

function resetApp() {
    resetSessionState(activeSessionState);
    dom.plan.mission.value = '';
    dom.plan.targetTime.value = '00:00';
    dom.focus.currentTime.textContent = '00:00:00';
    dom.focus.timerRing.style.setProperty('--pct', '0%');
    clearActiveSession();
    dom.review.continueButton.classList.replace('normal-button', 'cta-button');
}

async function handleFinishWork() {
    const sessionData = {
        date: new Date().toISOString(),
        mission: activeSessionState.currentMission,
        targetTimeSeconds: activeSessionState.targetTimeSeconds,
        actualTimeSeconds: activeSessionState.actualTimeSeconds
    };
    try {
        await postSession(sessionData);
        alert('Session saved successfully!\nReady for next session.');
    } catch (error) {
        console.error('Save error:', error);
        const addedToQueue = sessionQueue.add(sessionData);
        if (!addedToQueue) {
            alert('Queue full: connection issues persist. Cannot save more sessions.');
        } else {
            alert('Added to offline queue, will sync when online.');
        }
    }
    resetApp();
    navigateTo('dashboard', 'review');
    await loadDashboard();
}

async function loadDashboard() {
    showDashboardLoading();
    try {
        const sessions = await getSessions();
        renderDashboardData(sessions);
    } catch (error) {
        console.error('Dashboard loading error:', error);
    } finally {
        hideDashboardLoading();
    }
}

async function handleRegister(event) {
    event.preventDefault();
    dom.register.error.textContent = '';
    dom.register.passwordError.textContent = '';
    if (!dom.register.email.value || !dom.register.username.value) {
        dom.register.error.textContent = 'Email and Username are needed to register';
        return;
    }
    if (!dom.register.email.value.includes('@')) {
        dom.register.error.textContent = 'Email must contain @';
        return;
    }
    const passwordError = getPasswordError(dom.register.password.value);
    if (passwordError) {
        dom.register.passwordError.textContent = passwordError;
        return;
    }
    let result;
    try {
        result = await register(dom.register.username.value, dom.register.email.value, dom.register.password.value);
    } catch (error) {
        dom.register.error.textContent = 'Network/Server connection failed. Please try again';
        return;
    }
    if (result.status === 409) {
        dom.register.error.textContent = 'Username or Email already taken.';
        return;
    } else if (result.status === 400) {
        dom.register.error.textContent = 'Something went wrong. Please try again';
        return;
    } else if (result.success === true) {
        setAuthenticatedUser(result);
        navigateTo('plan', 'register');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    dom.login.error.textContent = '';
    if (!dom.login.usernameOrEmail.value) {
        dom.login.error.textContent = 'Email or Username is needed to log in';
        return;
    }
    let result;
    try {
        result = await login(dom.login.usernameOrEmail.value, dom.login.password.value);
    } catch (error) {
        dom.login.error.textContent = 'Network/Server connection failed. Please try again';
        return;
    }
    if (result.status === 401) {
        dom.login.error.textContent = 'Email, username or password is incorrect';
        return;
    } else if (result.status === 400) {
        dom.login.error.textContent = 'Something went wrong. Please try again';
        return;
    } else if (result.success === true) {
        setAuthenticatedUser(result);
        navigateTo('plan', 'login');
    }
}

async function handleLogout(currentScreen) {
    if (!confirm('Are you sure you want to log out?')) return;
    try {
        await logout();
        clearAuthenticatedUser();
        navigateTo('login', currentScreen);
    } catch (error) {
        alert('An unexpected network/server connection error occurred');
    }
}

function handleTargetTimeKeydown(event) {
    const allowedKeys = /^\d$/.test(event.key) || event.key === 'Backspace';
    if (!allowedKeys) return;
    event.preventDefault();
    let caretPosition = dom.plan.targetTime.selectionStart;
    if (caretPosition === null || caretPosition === 0) return;
    if (caretPosition === 3) caretPosition = 2;
    const digitPosition = caretPosition - 1;
    const replacement = event.key === 'Backspace' ? '0' : event.key;
    const characters = dom.plan.targetTime.value.split('');
    characters[digitPosition] = replacement;
    dom.plan.targetTime.value = characters.join('');
    dom.plan.targetTime.setSelectionRange(caretPosition, caretPosition);
}

async function handleDeleteSession(event) {
    const deleteButton = event.target.closest('.dashboard-delete-session-btn');
    if (!deleteButton) return;
    if (!confirm('Delete this session?')) return;
    try {
        await deleteSession(deleteButton.dataset.sessionId);
        const sessions = await getSessions();
        renderDashboardData(sessions);
    } catch (error) {
        alert('An unexpected network/server conection error occurred');
    }
}

async function handleOpenDashboard() {
    navigateTo('dashboard', 'plan');
    await loadDashboard();
}

async function handleSubmitFeedback(event) {
    event.preventDefault();

    const feedbackInput = dom.dashboard.feedbackInput;
    const sendButton = dom.dashboard.sendFeedbackButton;

    sendButton.disabled = true;

    if (!feedbackInput.value) {
        alert('Message is empty');
        sendButton.disabled = false;
        return;
    }
    if (feedbackInput.value.trim().length === 0) {
        alert('Message is only whitespace');
        sendButton.disabled = false;
        return;
    }
    if (feedbackInput.value.length > 2000) {
        alert('Message exceeds 2000 characters');
        sendButton.disabled = false;
        return;
    }

    let result;
    try {
        result = await postFeedback(feedbackInput.value);
    } catch (error) {
        alert('Network/Server connection failed. Please try again');
        return;
    } finally {
        sendButton.disabled = false;
    }
    if (result.status === 400) {
        alert('Message is invalid. Please check and try again');
        return;
    }
    if (result.success !== true) {
        alert('Something went wrong. Please try again');
        return;
    }

    alert('Feedback message was sent. Thank you');

    feedbackInput.value = '';
    feedbackInput.style.height = '';
    closeFeedbackForm();
}

function handleFeedbackInput() {
    const input = dom.dashboard.feedbackInput;
    input.style.overflowY = 'hidden';
    input.style.height = 'auto';
    const borderHeight = input.offsetHeight - input.clientHeight;
    input.style.height = `${input.scrollHeight + borderHeight}px`;
    if (input.scrollHeight > input.clientHeight + 1) {
        input.style.overflowY = 'auto';
    }
}

function handleDashboardToPlan() {
    navigateTo('plan', 'dashboard');
    if (dom.dashboard.feedbackForm.style.display === 'flex') closeFeedbackForm();
}


// ========== EVENT WIRING ==========

function registerEventListeners() {
    dom.loading.retryButton.addEventListener('click', async () => {
        showLoadingSpinner();
        await initializeApp();
    });

    dom.passwordButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const passwordInput = button.parentElement.querySelector('.input');
            togglePasswordVisibility(passwordInput, button);
        });
    });

    dom.register.switchToLoginButton.addEventListener('click', () => {
        hidePassword(dom.register.password);
        navigateTo('login', 'register');
    });
    dom.login.switchToRegisterButton.addEventListener('click', () => {
        hidePassword(dom.login.password);
        navigateTo('register', 'login');
    });
    dom.register.form.addEventListener('submit', handleRegister);
    dom.login.form.addEventListener('submit', handleLogin);

    dom.plan.userIcon.addEventListener('click', () => toggleUserMenu('plan'));
    dom.dashboard.userIcon.addEventListener('click', () => toggleUserMenu('dashboard'));
    dom.plan.logoutButton.addEventListener('click', () => handleLogout('plan'));
    dom.dashboard.logoutButton.addEventListener('click', () => handleLogout('dashboard'));
    document.addEventListener('click', closeUserMenusOnOutsideClick);

    dom.plan.targetTime.addEventListener('keydown', handleTargetTimeKeydown);
    dom.plan.dashboardButton.addEventListener('click', handleOpenDashboard);
    dom.plan.startButton.addEventListener('click', handleStartWork);
    dom.focus.pauseButton.addEventListener('click', handlePauseResume);
    dom.focus.stopButton.addEventListener('click', handleStopWork);
    dom.review.continueButton.addEventListener('click', handleContinueWork);
    dom.review.finishButton.addEventListener('click', handleFinishWork);

    dom.dashboard.newMissionButton.addEventListener('click', handleDashboardToPlan);
    dom.dashboard.emptyStartButton.addEventListener('click', handleDashboardToPlan);
    dom.dashboard.sessionsList.addEventListener('click', openSessionMenu);
    dom.dashboard.sessionsList.addEventListener('click', closeSessionMenu);
    dom.dashboard.sessionsList.addEventListener('click', handleDeleteSession);

    dom.dashboard.openFeedbackButton.addEventListener('click', openFeedbackForm);
    dom.dashboard.closeFeedbackButton.addEventListener('click', closeFeedbackForm);
    dom.dashboard.feedbackForm.addEventListener('submit', handleSubmitFeedback);
    dom.dashboard.feedbackInput.addEventListener('input', handleFeedbackInput);
    document.addEventListener('click', closeFeedbackFormOnOutsideClick);
}


// ========== INITIALIZATION ==========

registerEventListeners();
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});
