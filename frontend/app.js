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
let authenticatedUserId = null;
let isFinishingSession = false;
let isSyncingSessions = false;
let pendingSubmission = null;
let saveMessageFadeTimeout = null;
let saveMessageHideTimeout = null;
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
    cap: 15,
    /** Return the account-specific browser queue key. */
    storageKey(userId) {
        return `executionOS_sessionQueue:${userId}`;
    },
    /** Read and validate the account's queued submissions. */
    load(userId) {
        const stored = localStorage.getItem(this.storageKey(userId));
        const items = stored ? JSON.parse(stored) : [];
        if (!Array.isArray(items)) throw new Error('Invalid saved session queue');
        return items;
    },
    /** Queue a submission under a cross-tab storage lock. */
    async add(userId, item) {
        await navigator.locks.request(this.storageKey(userId), /** Add a submission while holding its account queue lock. */ () => {
            const items = this.load(userId);
            if (items.some(/** Match an already queued submission by its ID. */ (saved) => saved.submissionId === item.submissionId)) return;
            if (items.length >= this.cap) throw new Error('Session queue is full');
            localStorage.setItem(this.storageKey(userId), JSON.stringify([...items, item]));
        });
    },
    /** Remove a confirmed submission under a cross-tab storage lock. */
    async remove(userId, submissionId) {
        await navigator.locks.request(this.storageKey(userId), /** Remove a submission while holding its account queue lock. */ () => {
            const items = this.load(userId).filter(/** Retain submissions other than the confirmed one. */ (item) => item.submissionId !== submissionId);
            localStorage.setItem(this.storageKey(userId), JSON.stringify(items));
        });
    }
};

const dashboardState = {
    period: 'week',
    anchorDates: { week: '', month: '', year: '', all_time: '' },
    metric: 'time',
    data: null,
    sessions: [],
    dailySummaries: {},
    nextCursor: null,
    isLoadingMore: false,
    paginationFailed: false,
    isLoading: false,
    loadGeneration: 0,
    sessionObserver: null
};

const feedbackState = {
    currentScreen: null,
    isSending: false
};

const streakState = {
    anchorDate: '',
    data: null,
    openScreen: null,
    loadGeneration: 0
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
        emailError: document.getElementById('register-email-error-message'),
        usernameError: document.getElementById('register-username-error-message'),
        submitButton: document.getElementById('register-submit-btn'),
        error: document.getElementById('register-error-message'),
        switchToLoginButton: document.getElementById('register-switch-to-login-btn')
    },
    login: {
        screen: document.querySelector('.login-screen'),
        form: document.getElementById('login-form'),
        usernameOrEmail: document.getElementById('login-username-or-email-input'),
        identifierError: document.getElementById('login-identifier-error-message'),
        passwordError: document.getElementById('login-password-error-message'),
        password: document.getElementById('login-password-input'),
        submitButton: document.getElementById('login-submit-btn'),
        error: document.getElementById('login-error-message'),
        switchToRegisterButton: document.getElementById('login-switch-to-register-btn')
    },
    plan: {
        screen: document.querySelector('.plan-screen'),
        streakButton: document.getElementById('plan-streak-btn'),
        streakPopup: document.getElementById('plan-streak-popup'),
        userIcon: document.getElementById('plan-user-icon'),
        userMenu: document.getElementById('plan-user-menu'),
        username: document.getElementById('plan-user-menu-username'),
        menuIcon: document.getElementById('plan-user-menu-icon'),
        logoutButton: document.getElementById('plan-user-menu-logout-btn'),
        mission: document.getElementById('plan-mission-input'),
        missionError: document.getElementById('plan-mission-error'),
        targetTime: document.getElementById('plan-target-time-input'),
        timeError: document.getElementById('plan-time-error'),
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
        finishButton: document.getElementById('review-finish-btn'),
        saveMessage: document.getElementById('review-save-message')
    },
    dashboard: {
        screen: document.querySelector('.dashboard-screen'),
        backToStatsButton: document.getElementById('dashboard-back-to-stats-btn'),
        newMissionButton: document.getElementById('dashboard-new-mission-btn'),
        streakButton: document.getElementById('dashboard-streak-btn'),
        streakPopup: document.getElementById('dashboard-streak-popup'),
        userIcon: document.getElementById('dashboard-user-icon'),
        userMenu: document.getElementById('dashboard-user-menu'),
        username: document.getElementById('dashboard-user-menu-username'),
        menuIcon: document.getElementById('dashboard-user-menu-icon'),
        logoutButton: document.getElementById('dashboard-user-menu-logout-btn'),
        content: document.getElementById('dashboard-content'),
        saveMessage: document.getElementById('dashboard-save-message'),
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
        emptyStartButton: document.getElementById('empty-dashboard-start-mission-btn'),
        feedbackForm: document.getElementById('dashboard-feedback-form'),
        closeFeedbackButton: document.getElementById('dashboard-close-feedback-form-btn'),
        feedbackInput: document.getElementById('dashboard-feedback-input'),
        feedbackMessage: document.getElementById('feedback-message'),
        sendFeedbackButton: document.getElementById('dashboard-send-feedback-btn')
    },
    passwordButtons: document.querySelectorAll('.password-visibility-btn')
};


// ========== DURATION AND SESSION DOMAIN ==========

/** Convert an HH:MM duration to seconds. */
function parseHHMMToSeconds(timeString) {
    const [hours, minutes] = timeString.split(':');
    return parseInt(hours) * 3600 + parseInt(minutes) * 60;
}

/** Format elapsed seconds for the timer display. */
function formatDuration(totalSeconds) {
    const hours = Math.floor(Number(totalSeconds) / 3600);
    const minutes = Math.floor((Number(totalSeconds) % 3600) / 60);
    const seconds = Number(totalSeconds) % 60;
    if (hours >= 1) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (minutes >= 1) return `${minutes}:${String(seconds).padStart(2, '0')}`;
    return seconds;
}

/** Format a duration using hours and whole minutes. */
function formatDurationHoursMinutes(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours >= 1) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

/** Format a duration with unit labels and sub-minute seconds. */
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

/** Update elapsed time from timestamps and return exact completion percentage. */
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

/** Start periodic display updates for a running session. */
function startTimer(session) {
    session.isTimerRunning = true;
    timerInterval = setInterval(updateTimer, 1000);
}

/** Refresh and persist the running session's elapsed time. */
function updateTimer() {
    if (!activeSessionState.isTimerRunning) return;
    const exactPercentage = updateElapsedSessionTime(activeSessionState);
    renderFocusTimer(activeSessionState, exactPercentage);
    saveActiveSession(activeSessionState);
}

/** Pause display updates and record when the pause began. */
function pauseSession(session) {
    clearInterval(timerInterval);
    session.isTimerRunning = false;
    session.pauseStartTimestamp = new Date();
}

/** Account for paused time and restart display updates. */
function resumeSession(session) {
    const elapsed = (Date.now() - new Date(session.pauseStartTimestamp).getTime()) / 1000;
    session.pausedTimeSeconds += elapsed;
    session.pauseStartTimestamp = '';
    startTimer(session);
}

/** Stop the timer and capture the session's final elapsed time. */
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

/** Clear the current mission and timing state. */
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

/** Return the first unmet password requirement, or an empty string. */
function getPasswordError(password) {
    if (password.length < 12) return 'At least 12 characters.';
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#\$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]).+$/;
    if (!regex.test(password)) return 'Add uppercase, lowercase, a number and a symbol.';
    return '';
}


// ========== LOCAL PERSISTENCE AND OFFLINE QUEUE ==========

/** Persist active session state and its pending submission. */
function saveActiveSession(session) {
    const activeSession = {
        mission: session.currentMission,
        targetTimeSeconds: session.targetTimeSeconds,
        actualTimeSeconds: session.actualTimeSeconds,
        startTimestamp: session.startTimestamp,
        pauseStartTimestamp: session.pauseStartTimestamp,
        pausedTimeSeconds: session.pausedTimeSeconds,
        userId: authenticatedUserId,
        pendingSubmission
    };
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(activeSession));
}

/** Restore an eligible active session in a paused state. */
function loadActiveSession(session) {
    const stored = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!stored) return false;

    const activeSession = JSON.parse(stored);
    if (activeSession.userId != null && activeSession.userId !== authenticatedUserId) return false;
    pendingSubmission = activeSession.pendingSubmission ?? null;
    session.currentMission = activeSession.mission;
    session.targetTimeSeconds = activeSession.targetTimeSeconds;
    session.actualTimeSeconds = activeSession.actualTimeSeconds;
    session.startTimestamp = activeSession.startTimestamp;
    session.pauseStartTimestamp = activeSession.pauseStartTimestamp;
    session.pausedTimeSeconds = activeSession.pausedTimeSeconds;
    session.percentageCompleted = Math.floor(session.actualTimeSeconds / session.targetTimeSeconds * 100);
    session.completionStatus = session.actualTimeSeconds >= session.targetTimeSeconds ? 'completed' : 'partial';

    if (!session.pauseStartTimestamp) {
        const startTime = new Date(session.startTimestamp).getTime();
        const lastActiveTime = startTime + (session.actualTimeSeconds + session.pausedTimeSeconds) * 1000;
        session.pauseStartTimestamp = new Date(lastActiveTime).toISOString();
        saveActiveSession(session);
    }
    return true;
}

/** Remove the persisted active session. */
function clearActiveSession() {
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
}

/** Retry the signed-in account's queued submissions and refresh displayed totals. */
async function syncOfflineWork() {
    if (!accessToken || isSyncingSessions || isFinishingSession) return;
    const userId = authenticatedUserId;
    isSyncingSessions = true;
    let synced = 0;
    let queueLoaded = false;
    try {
        const items = sessionQueue.load(userId);
        queueLoaded = true;
        if (!items.length) return;
        for (const item of items) {
            if (authenticatedUserId !== userId) return;
            await postSession(item, userId);
            if (authenticatedUserId !== userId) return;
            await sessionQueue.remove(userId, item.submissionId);
            synced += 1;
        }
        setDashboardSaveMessage('Your saved sessions are synced. Nice work.', { saved: true });
    } catch (error) {
        console.error('Session sync failed:', error);
        if (authenticatedUserId !== userId) return;
        const needsSignIn = error.status === 401 || error.status === 403;
        let message = 'Sessions saved on this browser are waiting to sync. Dashboard totals update after syncing.';
        if (!queueLoaded) message = 'Couldn’t read browser saves. Please reload to try again.';
        else if (needsSignIn) message = 'Sessions are saved on this browser. Sign in again to sync them.';
        else if (error.status === 400 || error.status === 409) {
            message = 'A saved session needs attention before it can sync. It is still on this browser.';
        }
        setDashboardSaveMessage(message);
    } finally {
        isSyncingSessions = false;
        if (synced && authenticatedUserId === userId) {
            if (dom.dashboard.screen.style.display !== 'none' && dom.dashboard.screen.style.display) {
                await loadDashboard();
            } else {
                await loadStreak('plan');
            }
        }
    }
}

/** Show temporary save feedback with a five-second hold and one-second fade. */
function setDashboardSaveMessage(message, { saved = false } = {}) {
    clearTimeout(saveMessageFadeTimeout);
    clearTimeout(saveMessageHideTimeout);
    dom.dashboard.saveMessage.textContent = message;
    dom.dashboard.saveMessage.classList.toggle('session-save-success', saved);
    dom.dashboard.saveMessage.classList.remove('is-fading');
    dom.dashboard.saveMessage.hidden = !message;
    if (!message) return;
    saveMessageFadeTimeout = setTimeout(/** Begin fading the save message after its display interval. */ () => {
        dom.dashboard.saveMessage.classList.add('is-fading');
        saveMessageHideTimeout = setTimeout(/** Hide the save message after its fade completes. */ () => {
            dom.dashboard.saveMessage.hidden = true;
        }, 1000);
    }, 5000);
}

/** Wait until feedback has been visible for at least two seconds. */
async function waitForMinimumFeedback(startedAt) {
    const remaining = 2000 - (performance.now() - startedAt);
    if (remaining > 0) await new Promise(/** Resolve when the remaining feedback interval expires. */ (resolve) => setTimeout(resolve, remaining));
}


// ========== API AND AUTHENTICATION TRANSPORT ==========

/** Send a cookie-enabled unauthenticated JSON request and include its HTTP status. */
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

/** Submit account registration details. */
function register(username, email, password) {
    return unauthFetch({ path: 'register', method: 'POST', body: { username, email, password } });
}

/** Submit username or email and password credentials. */
function login(usernameOrEmail, password) {
    return unauthFetch({ path: 'login', method: 'POST', body: { usernameOrEmail, password } });
}

/** Request fresh credentials using the refresh cookie. */
async function refreshAccessToken() {
    const response = await fetch(`${BACKEND_URL}/api/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: AbortSignal.timeout(20000)
    });
    if (response.status === 401 || response.status === 403) return '';

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Token refresh failed');
    return result;
}

/** Send a JSON request with the supplied access token. */
function sendAuthenticatedRequest(options, token) {
    return fetch(`${BACKEND_URL}/api/${options.path}`, {
        method: options.method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(options.body),
        signal: options.signal
    });
}

/** Send an authenticated request and retry once after token refresh. */
async function apiFetch(options) {
    if (!options.path || !options.method) {
        throw new Error('Missing required options: path and method');
    }
    const response = await sendAuthenticatedRequest(options, accessToken);
    if (response.status === 401) {
        const result = await refreshAccessToken();
        if (!result || (options.userId != null && result.user_id !== options.userId)) {
            const error = new Error('Please sign in to the account that owns this session.');
            error.status = 401;
            if (!options.keepScreen) {
                navigateTo('login', options.currentScreen);
                dom.login.error.textContent = 'Please sign in again. Queued sessions remain on this browser.';
            }
            throw error;
        }
        const retry = await sendAuthenticatedRequest(options, result.access_token);
        if (retry.status === 401) {
            if (!options.keepScreen) {
                navigateTo('login', options.currentScreen);
                dom.login.error.textContent = 'Please sign in again. Queued sessions remain on this browser.';
            }
            const error = new Error('Unauthorized: Please log in.');
            error.status = 401;
            throw error;
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

/** Request refresh-session invalidation on the server. */
function logout() {
    return apiFetch({ path: 'logout', method: 'POST' });
}

/** Submit a session for its owner and require confirmed server acceptance. */
async function postSession(sessionData, userId) {
    if (userId !== authenticatedUserId) throw new Error('Session account changed');
    const result = await apiFetch({
        path: 'save-session', method: 'POST', body: sessionData,
        currentScreen: 'review', keepScreen: true, userId,
        signal: AbortSignal.timeout(20000)
    });
    if (result.status < 200 || result.status >= 300 || result.success !== true) {
        const error = new Error(result.error || 'The server did not save this session');
        error.status = result.status;
        throw error;
    }
    return result;
}

/** Return the browser's resolved time zone. */
function getBrowserTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Request summary and trend data for the selected period. */
function fetchDashboardData(period, anchorDate, currentScreen = 'dashboard') {
    const params = new URLSearchParams({
        period,
        anchor_date: anchorDate,
        timezone: getBrowserTimezone()
    });

    return apiFetch({
        path: `dashboard?${params.toString()}`,
        method: 'GET',
        currentScreen
    });
}

/** Request a filtered page of sessions and daily summaries. */
function fetchSessionsPage(
    period,
    anchorDate,
    cursor = null,
    currentScreen = 'dashboard'
) {
    const params = new URLSearchParams({
        period,
        anchor_date: anchorDate,
        timezone: getBrowserTimezone()
    });

    if (cursor) {
        params.set('cursor_date', cursor.date);
        params.set('cursor_id', String(cursor.id));
    }

    return apiFetch({
        path: `get-sessions?${params.toString()}`,
        method: 'GET',
        currentScreen
    });
}

/** Request streak and calendar data for a month. */
function fetchStreak(anchorDate, currentScreen) {
    const params = new URLSearchParams({
        anchor_date: anchorDate,
        timezone: getBrowserTimezone()
    });

    return apiFetch({
        path: `streak?${params.toString()}`,
        method: 'GET',
        currentScreen
    });
}

/** Request deletion of an owned session. */
function deleteSession(sessionId) {
    return apiFetch({ path: `delete-session/${sessionId}`, method: 'DELETE', currentScreen: 'dashboard' });
}

/** Submit a feedback message from the current screen. */
function postFeedback(feedbackMessage, currentScreen) {
    return apiFetch({ path: 'feedback', method: 'POST', body: { message: feedbackMessage }, currentScreen });
}


// ========== DASHBOARD DATA ==========

/** Format a local calendar date as YYYY-MM-DD. */
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Initialize the selected period's date while preserving previous selections. */
function initializeDashboardState() {
    const period = dashboardState.period;
    if (period === 'all_time' || !dashboardState.anchorDates[period]) {
        dashboardState.anchorDates[period] = normalizePeriodAnchor(
            period,
            formatLocalDate(new Date())
        );
    }
}

/** Reset streak data and calendar navigation state. */
function initializeStreakState() {
    if (!streakState.anchorDate) {
        streakState.anchorDate = formatLocalDate(new Date());
    }
}

/** Parse a YYYY-MM-DD string as a local calendar date. */
function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/** Normalize an anchor to the selected calendar period. */
function normalizePeriodAnchor(period, anchorDate) {
    const date = parseLocalDate(anchorDate);
    if (period === 'week') {
        const daysSinceMonday = (date.getDay() + 6) % 7;
        date.setDate(date.getDate() - daysSinceMonday);
    } else if (period === 'month') {
        date.setDate(1);
    } else if (period === 'year') {
        date.setMonth(0, 1);
    }
    return formatLocalDate(date);
}

/** Move an anchor backward or forward by one period. */
function shiftPeriodAnchor(period, anchorDate, direction) {
    const date = parseLocalDate(
        normalizePeriodAnchor(period, anchorDate)
    );

    if (period === 'week') {
        date.setDate(date.getDate() + 7 * direction);
    } else if (period === 'month') {
        date.setMonth(date.getMonth() + direction);
    } else if (period === 'year') {
        date.setFullYear(date.getFullYear() + direction);
    }

    return formatLocalDate(date);
}

/** Move an anchor backward or forward by one calendar month. */
function shiftMonthAnchor(anchorDate, direction) {
    const date = parseLocalDate(anchorDate);
    date.setDate(1);
    date.setMonth(date.getMonth() + direction);
    return formatLocalDate(date);
}

/** Convert a session timestamp to a local Date. */
function getSessionLocalDate(session) {
    return new Date(`${session.date}Z`);
}

/** Return a session's local calendar date key. */
function getSessionLocalDateKey(session) {
    return formatLocalDate(getSessionLocalDate(session));
}

/** Format a session date for a history card heading. */
function formatSessionDateLabel(session) {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    }).format(getSessionLocalDate(session));
}

/** Format a calendar date for period navigation. */
function formatPeriodDate(dateString) {
    if (!dateString) return '';

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric'
    }).format(parseLocalDate(dateString));
}

/** Format a trend bucket label for the selected period. */
function formatTrendBucketLabel(bucketStart, period) {
    const date = parseLocalDate(bucketStart);

    if (period === 'week') {
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'short'
        }).format(date);
    }

    if (period === 'month') {
        return String(date.getDate());
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short'
    }).format(date);
}


// ========== SHARED UI PRESENTATION ==========

/** Store authenticated identity and update the displayed username. */
function setAuthenticatedUser(result) {
    if (authenticatedUserId !== (result.user_id ?? null)) {
        pendingSubmission = null;
        setDashboardSaveMessage('');
    }
    accessToken = result.access_token;
    authenticatedUserId = result.user_id ?? null;
    dom.plan.username.textContent = result.username;
    dom.dashboard.username.textContent = result.username;
}

/** Clear in-memory identity and displayed account feedback. */
function clearAuthenticatedUser() {
    accessToken = null;
    authenticatedUserId = null;
    setDashboardSaveMessage('');
    dom.plan.username.textContent = '';
    dom.dashboard.username.textContent = '';
}

/** Render completion using the colors before and after the target. */
function renderProgressRing(ring, percentage, beforeTargetColor, afterTargetColor) {
    if (percentage < 100) {
        ring.style.setProperty('--pct', `${percentage}%`);
        ring.style.background =
            `conic-gradient(${beforeTargetColor} 0%, ${beforeTargetColor} var(--pct), var(--color-border) var(--pct), var(--color-border) 100%)`;
    } else {
        ring.style.setProperty('--pct', `${percentage - 100}%`);
        ring.style.background =
            `conic-gradient(var(--color-white) 0%, var(--color-white) var(--pct), ${afterTargetColor} var(--pct), ${afterTargetColor} 100%)`;
    }
}

/** Update the Focus timer value and progress ring. */
function renderFocusTimer(session, exactPercentage) {
    dom.focus.currentTime.textContent = formatDuration(session.actualTimeSeconds);
    renderProgressRing(dom.focus.timerRing, exactPercentage, 'var(--color-white)', 'var(--color-reward)');
}

/** Render the current mission, target, and elapsed time. */
function renderFocusSession(session) {
    dom.focus.mission.textContent = session.currentMission;
    dom.focus.targetTime.textContent = formatDuration(session.targetTimeSeconds);
    dom.focus.currentTime.textContent = formatDuration(session.actualTimeSeconds);
}

/** Render session results and the completion-dependent Continue button. */
function renderReviewSession(session) {
    dom.review.mission.textContent = session.currentMission;
    dom.review.targetTime.textContent = `Target: ${formatDurationHoursMinutesSeconds(session.targetTimeSeconds)}`;
    dom.review.percentage.textContent = `${session.percentageCompleted}%`;
    dom.review.status.textContent =
        session.completionStatus.charAt(0).toUpperCase() + session.completionStatus.slice(1);
    dom.review.actualTime.textContent = formatDurationHoursMinutesSeconds(session.actualTimeSeconds);
    renderProgressRing(dom.review.progressRing, session.percentageCompleted, 'var(--color-cta)', 'var(--color-reward)');
    if (session.percentageCompleted >= 100) {
        dom.review.continueButton.classList.replace('cta-button', 'normal-button');
    }
}

/** Replace the startup spinner with error feedback and Retry. */
function showLoadingScreenError() {
    dom.loading.screen.classList.add('has-loading-error');
    dom.loading.spinner.style.display = 'none';
    dom.loading.error.style.display = 'flex';
    dom.loading.retryButton.style.display = 'flex';
}

/** Show the startup spinner and hide previous error feedback. */
function showLoadingSpinner() {
    dom.loading.screen.classList.remove('has-loading-error');
    dom.loading.spinner.style.display = 'flex';
    dom.loading.error.style.display = 'none';
    dom.loading.retryButton.style.display = dom.loading.retryButton.disabled ? 'flex' : 'none';
}

/** Set password visibility and the visibility button's accessible label. */
function setPasswordVisibility(passwordInput, visibilityButton, visible) {
    const showIcon = visibilityButton.querySelector('.password-show-icon');
    const hideIcon = visibilityButton.querySelector('.password-hide-icon');
    passwordInput.type = visible ? 'text' : 'password';
    showIcon.style.display = visible ? 'none' : 'block';
    hideIcon.style.display = visible ? 'block' : 'none';
    visibilityButton.ariaLabel = visible ? 'Hide password' : 'Show password';
}

/** Toggle a password field between concealed and visible text. */
function togglePasswordVisibility(passwordInput, visibilityButton) {
    setPasswordVisibility(passwordInput, visibilityButton, passwordInput.type === 'password');
}

/** Conceal a password and reset its visibility control. */
function hidePassword(passwordInput) {
    const visibilityButton = passwordInput.parentElement.querySelector('.password-visibility-btn');
    setPasswordVisibility(passwordInput, visibilityButton, false);
}

/** Toggle the account menu for the selected screen. */
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

/** Close account menus when a click occurs outside their controls. */
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
    focus: ['loading', 'login', 'register', 'plan', 'review'],
    review: ['loading', 'login', 'register', 'focus'],
    dashboard: ['plan', 'review']
};

/** Apply an allowed screen transition and prepare its presentation. */
function navigateTo(nextScreen, currentScreen) {
    if (!ALLOWED_SCREEN_TRANSITIONS[nextScreen]?.includes(currentScreen)) return;
    closeFeedbackForm();
    if (currentScreen === 'dashboard' && nextScreen !== 'dashboard') {
        dashboardState.loadGeneration += 1;
        dashboardState.isLoading = false;
        dashboardState.isLoadingMore = false;
        dashboardState.sessionObserver?.disconnect();
    }
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
    updateBackToStatsButton();
}

/** Show Dashboard loading surfaces and hide results and errors. */
function showDashboardLoading() {
    dom.dashboard.error.style.display = 'none';
    dom.dashboard.dataContainer.style.display = 'none';
    dom.dashboard.emptyCTA.style.display = 'none';
    dom.dashboard.loading.style.display = 'flex';
    updateBackToStatsButton();
}

/** Hide Dashboard loading surfaces. */
function hideDashboardLoading() {
    dom.dashboard.loading.style.display = 'none';
}


/** Show Dashboard error feedback and hide loading and results. */
function showDashboardError() {
    hideDashboardLoading();
    dom.dashboard.dataContainer.style.display = 'none';
    dom.dashboard.emptyCTA.style.display = 'none';
    dom.dashboard.error.style.display = 'flex';
    updateBackToStatsButton();
}

// ========== DASHBOARD UI ==========

/** Show the shortcut when session history reaches the top of the viewport. */
function updateBackToStatsButton() {
    const firstCard = dom.dashboard.sessionsList.querySelector('.dashboard-session-card');
    const disabled = !firstCard
        || firstCard.getClientRects().length === 0
        || firstCard.getBoundingClientRect().top > 0;
    dom.dashboard.backToStatsButton.disabled = disabled;
    dom.dashboard.backToStatsButton.setAttribute('aria-hidden', String(disabled));
}

/** Return to Stats below the sticky header, respecting reduced motion. */
function handleBackToStats() {
    const header = dom.dashboard.screen.querySelector('.dashboard-header');
    const top = window.scrollY + dom.dashboard.summaryContainer.getBoundingClientRect().top
        - header.getBoundingClientRect().bottom - 24;
    dom.dashboard.summaryContainer.focus({ preventScroll: true });
    window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
}

/** Create the session history heading. */
function createSessionListTitle() {
    const title = document.createElement('h2');
    title.className = 'dashboard-content-title';
    title.textContent = 'Session History';
    return title;
}

/** Create a session's mission and deletion menu. */
function createSessionMissionSection(session) {
    const container = document.createElement('div');
    const mission = document.createElement('p');
    const openMenuIcon = document.createElement('span');
    const menu = document.createElement('div');
    const deleteButton = document.createElement('button');

    container.className = 'dashboard-session-mission-container';
    mission.className = 'dashboard-session-mission';
    openMenuIcon.className = 'material-symbols-outlined dashboard-session-open-menu-icon dashboard-session-toggle-menu-icon';
    menu.className = 'dashboard-session-menu';
    deleteButton.className = 'dashboard-delete-session-btn';

    mission.textContent = session.mission;
    openMenuIcon.textContent = 'more_vert';
    deleteButton.textContent = 'Delete Session';
    deleteButton.dataset.sessionId = session.id;

    container.append(mission, openMenuIcon, menu);
    menu.append(deleteButton);
    return container;
}

/** Create a session's target, focused time, and completion metrics. */
function createSessionTimeSection(session) {
    const container = document.createElement('div');
    const targetTime = document.createElement('p');
    const actualTime = document.createElement('p');
    const percentage = document.createElement('p');

    container.className = 'dashboard-session-time-and-percentage-container';
    targetTime.className = 'dashboard-session-target-time';
    actualTime.className = 'dashboard-session-actual-time';
    percentage.className = 'dashboard-session-percentage';

    targetTime.textContent = `${formatDurationHoursMinutes(session.target_time_seconds)} target`;
    actualTime.textContent = `${formatDurationHoursMinutes(session.actual_time_seconds)} focused`;
    percentage.textContent = `${Math.floor(session.percentage_completed)}% completion`;

    container.append(targetTime, actualTime, percentage);
    return container;
}

/** Create aggregated metrics for a day of sessions. */
function createDailySummarySection(summary) {
    const container = document.createElement('div');
    const title = document.createElement('p');
    const metrics = document.createElement('div');
    const totalTime = document.createElement('p');
    const sessions = document.createElement('p');
    const completion = document.createElement('p');

    container.className = 'dashboard-daily-summary';
    title.className = 'dashboard-daily-summary-title';
    metrics.className = 'dashboard-daily-summary-metrics';
    title.textContent = 'Daily Summary';
    totalTime.textContent = `${formatDurationHoursMinutes(summary.total_time_seconds)} focused`;
    sessions.textContent = `${summary.total_sessions} sessions`;
    completion.textContent = `${Math.round(summary.average_completion_percentage)}% avg. completion`;

    metrics.append(sessions, totalTime, completion);
    container.append(title, metrics);
    return container;
}

/** Append mission and time sections to a session card. */
function appendSessionToCard(session, card) {
    card.append(createSessionMissionSection(session), createSessionTimeSection(session));
}

/** Group sessions by local calendar date. */
function groupSessionsByLocalDate(sessions) {
    const groups = new Map();
    for (const session of sessions) {
        const dateKey = getSessionLocalDateKey(session);
        if (!groups.has(dateKey)) {
            groups.set(dateKey, []);
        }
        groups.get(dateKey).push(session);
    }
    return groups;
}

/** Build a daily history card with an optional aggregate summary. */
function createSessionDateCard(
    sessions,
    dailySummary
) {
    const firstSession = sessions[0];

    const card = document.createElement('div');
    const dateLabel = document.createElement('p');

    const dateKey =
        getSessionLocalDateKey(firstSession);

    card.className = 'dashboard-session-card';
    card.id = `session-card-${dateKey}`;

    dateLabel.className = 'dashboard-session-date';
    dateLabel.textContent =
        formatSessionDateLabel(firstSession);

    card.appendChild(dateLabel);

    if (
        dailySummary
        && dailySummary.total_sessions > 1
    ) {
        card.appendChild(
            createDailySummarySection(dailySummary)
        );
    }

    sessions.forEach(/** Append a session and its separator to the daily card. */ (session, index) => {
        if (index > 0 || (dailySummary && dailySummary.total_sessions > 1)) {
            const divider =
                document.createElement('span');

            divider.className =
                'dashboard-session-division-line';

            card.appendChild(divider);
        }

        appendSessionToCard(session, card);
    });

    return card;
}

/** Render session history grouped into daily cards. */
function renderSessionsByDate(sessions) {
    dom.dashboard.sessionsList.innerHTML = '';
    dom.dashboard.sessionsList.appendChild(createSessionListTitle());
    if (sessions.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No sessions in this period.';
        emptyMessage.className = 'dashboard-empty-period-message';
        dom.dashboard.sessionsList.appendChild(emptyMessage);
        updateBackToStatsButton();
        return;
    }
    const groups = groupSessionsByLocalDate(sessions);
    for (const [dateKey, daySessions] of groups.entries()) {
    const dailySummary =
        dashboardState.dailySummaries[dateKey];

    dom.dashboard.sessionsList.appendChild(
        createSessionDateCard(
            daySessions,
            dailySummary
        )
    );
}
    dom.dashboard.sessionsList.appendChild(
        dom.dashboard.sessionsLoadSentinel
    );
    updateBackToStatsButton();
}

/** Update the Dashboard's summary values. */
function renderDashboardSummary(summary) {
    dom.dashboard.sessionCount.textContent = String(summary.total_sessions);
    dom.dashboard.totalTime.textContent = formatDurationHoursMinutes(summary.total_time_seconds);
    dom.dashboard.averagePercentage.textContent =
        summary.average_completion_percentage === null
            ? '—'
            : `${Math.round(summary.average_completion_percentage)}%`;
    dom.dashboard.averageSessionTime.textContent =
        summary.average_session_time_seconds === null
            ? '—'
            : `${formatDurationHoursMinutes(
                summary.average_session_time_seconds
            )}`;
}

/** Update selected period controls and calendar navigation. */
function renderDashboardPeriod(periodData) {
    dom.dashboard.periodButtons.forEach(/** Mark the button for the selected Dashboard period. */ (button) => {
        button.classList.toggle(
            'active',
            button.dataset.dashboardPeriod === dashboardState.period
        );
    });

    if (dashboardState.period === 'all_time') {
        dom.dashboard.periodLabel.textContent = '';
    } else if (dashboardState.period === 'month') {
        dom.dashboard.periodLabel.textContent = new Intl.DateTimeFormat('en-US', {
            month: 'long'
        }).format(parseLocalDate(periodData.start_date));
    } else if (dashboardState.period === 'year') {
        dom.dashboard.periodLabel.textContent =
            String(parseLocalDate(periodData.start_date).getFullYear());
    } else {
        dom.dashboard.periodLabel.textContent =
            `${formatPeriodDate(periodData.start_date)} – ` +
            `${formatPeriodDate(periodData.end_date)}`;
    }

    dom.dashboard.periodNavigation.hidden =
        dashboardState.period === 'all_time';

    dom.dashboard.previousPeriodButton.disabled =
        dashboardState.period === 'all_time';

    const today = formatLocalDate(new Date());

    dom.dashboard.nextPeriodButton.disabled =
        dashboardState.period === 'all_time'
        || periodData.end_date >= today;
}

/** Render navigation from the current Dashboard selection. */
function renderSelectedDashboardPeriod() {
    if (dashboardState.period === 'all_time') {
        renderDashboardPeriod({});
        return;
    }
    const start = normalizePeriodAnchor(dashboardState.period, dashboardState.anchorDates[dashboardState.period]);
    const end = parseLocalDate(start);
    if (dashboardState.period === 'week') end.setDate(end.getDate() + 6);
    else if (dashboardState.period === 'month') end.setMonth(end.getMonth() + 1, 0);
    else end.setMonth(11, 31);
    renderDashboardPeriod({start_date: start, end_date: formatLocalDate(end)});
}

/** Select the numeric value for a trend metric. */
function getTrendMetricValue(bucket, metric) {
    if (metric === 'time') {
        return bucket.total_time_seconds;
    }
    if (metric === 'completion') {
        return bucket.average_completion_percentage ?? 0;
    }
    return bucket.total_sessions;
}

/** Format a trend value for its metric. */
function formatTrendMetricValue(value, metric) {
    if (metric === 'time') {
        return formatDurationHoursMinutes(value);
    }
    if (metric === 'completion') {
        return `${Math.round(value)}%`;
    }
    return String(value);
}

/** Mark the selected trend metric button. */
function renderTrendMetricButtons() {
    dom.dashboard.metricButtons.forEach(/** Mark the button for the selected trend metric. */ (button) => {
        button.classList.toggle(
            'active',
            button.dataset.dashboardMetric === dashboardState.metric
        );
    });
}

/** Generate spaced axis ticks including the exact maximum. */
function getTrendAxisTicks(maxValue, metric) {

    const unit = metric === 'time' ? 60 : 1;
    const step = Math.max(unit, Math.floor(maxValue / 4 / unit) * unit);
    const ticks = [0];
    for (let value = step; value < maxValue; value += step) {

        if (maxValue - value >= step / 2) ticks.push(value);
    }
    ticks.push(maxValue);
    return ticks;
}

/** Build a cubic curve path with flat tangents at local extrema. */
function createTrendCurvePath(points) {
    if (points.length < 2) return '';
    const slopes = points.slice(1).map(/** Calculate the slope between adjacent chart points. */ (point, index) =>
        (point.y - points[index].y) / (point.x - points[index].x)
    );
    const tangents = points.map(/** Calculate the tangent at a chart point. */ (point, index) => {
        if (index === 0) return slopes[0];
        if (index === points.length - 1) return slopes[index - 1];
        const before = slopes[index - 1];
        const after = slopes[index];

        if (before * after <= 0) return 0;
        return 2 * before * after / (before + after);
    });
    let path = `M ${points[0].x},${points[0].y}`;
    points.slice(1).forEach(/** Append the cubic segment ending at this chart point. */ (point, index) => {
        const previous = points[index];
        const thirdWidth = (point.x - previous.x) / 3;
        path += ` C ${previous.x + thirdWidth},${previous.y + tangents[index] * thirdWidth}`
            + ` ${point.x - thirdWidth},${point.y - tangents[index + 1] * thirdWidth}`
            + ` ${point.x},${point.y}`;
    });
    return path;
}

/** Render axes, gridlines, and available trend values as SVG. */
function renderTrendChart() {
    const svg = dom.dashboard.trendChart;
    const today = formatLocalDate(new Date());
    const currentMonth = `${today.slice(0, 7)}-01`;
    const allBuckets = dashboardState.data?.trend ?? [];

    const trend = dashboardState.period === 'year'
        ? allBuckets.filter(/** Retain calendar buckets through the current month. */ (bucket) => bucket.bucket_start <= currentMonth)
        : allBuckets;

    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 700 260');

    if (trend.length === 0) return;

    const width = 700;
    const height = 260;

    const left = 85;
    const right = 20;
    const top = 25;
    const bottom = 45;

    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    const plottedBuckets = trend.filter(/** Retain buckets through the current local day. */ (bucket) => bucket.bucket_start <= today);
    const values = plottedBuckets.map(/** Extract the selected metric from a plotted bucket. */ (bucket) =>
        getTrendMetricValue(bucket, dashboardState.metric)
    );

    const minimumMax = dashboardState.metric === 'time'
        ? 3600
        : dashboardState.metric === 'completion' ? 100 : 1;
    const maxValue = Math.max(...values, minimumMax);

    /** Create an element in the SVG namespace. */
    const createSvgElement = (tag) =>
        document.createElementNS(
            'http://www.w3.org/2000/svg',
            tag
        );

    getTrendAxisTicks(maxValue, dashboardState.metric).forEach(/** Append a horizontal gridline and its axis label. */ (value) => {
        const y = top + chartHeight - (value / maxValue) * chartHeight;
        const gridline = createSvgElement('line');
        gridline.setAttribute('x1', left);
        gridline.setAttribute('x2', left + chartWidth);
        gridline.setAttribute('y1', y);
        gridline.setAttribute('y2', y);
        gridline.setAttribute('class', 'dashboard-trend-gridline');
        svg.appendChild(gridline);

        const label = createSvgElement('text');
        label.setAttribute('x', left - 12);
        label.setAttribute('y', y);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('dominant-baseline', 'middle');
        label.setAttribute('class', 'dashboard-trend-axis-label');
        label.textContent = formatTrendMetricValue(value, dashboardState.metric);
        const title = createSvgElement('title');
        title.textContent = label.textContent;
        label.appendChild(title);
        svg.appendChild(label);
    });

    const axisPoints = trend.map(/** Calculate chart coordinates and metric data for a bucket. */ (bucket, index) => {
        const x = trend.length === 1
            ? left + chartWidth / 2
            : left + (index / (trend.length - 1)) * chartWidth;

        const value = getTrendMetricValue(bucket, dashboardState.metric);

        const y =
            top
            + chartHeight
            - (value / maxValue) * chartHeight;

        return {
            x,
            y,
            value,
            bucket
        };
    });

    const points = axisPoints.filter(/** Retain chart points through the current local day. */ (point) => point.bucket.bucket_start <= today);
    const labelInterval = Math.max(1, Math.ceil(axisPoints.length / 8));
    axisPoints.forEach(/** Append vertical gridlines at labeled bucket positions. */ (point, index) => {
        if (index % labelInterval !== 0 && index !== axisPoints.length - 1) return;
        const gridline = createSvgElement('line');
        gridline.setAttribute('x1', point.x);
        gridline.setAttribute('x2', point.x);
        gridline.setAttribute('y1', top);
        gridline.setAttribute('y2', top + chartHeight);
        gridline.setAttribute('class', 'dashboard-trend-gridline');
        svg.appendChild(gridline);
    });

    const curvePath = createTrendCurvePath(points);
    if (curvePath) {
        const defs = createSvgElement('defs');
        const gradient = createSvgElement('linearGradient');
        gradient.setAttribute('id', 'dashboard-trend-fill');
        gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
        gradient.setAttribute('x1', '0');
        gradient.setAttribute('x2', '0');
        gradient.setAttribute('y1', top);
        gradient.setAttribute('y2', top + chartHeight);
        [0, 1].forEach(/** Append a color stop to the trend area gradient. */ (offset) => {
            const stop = createSvgElement('stop');
            stop.setAttribute('offset', offset);
            stop.setAttribute('stop-color', 'var(--color-reward)');
            stop.setAttribute('stop-opacity', offset === 0 ? '0.2' : '0');
            gradient.appendChild(stop);
        });
        defs.appendChild(gradient);
        svg.appendChild(defs);

        const area = createSvgElement('path');
        area.setAttribute('d', `${curvePath} L ${points[points.length - 1].x},${top + chartHeight}`
            + ` L ${points[0].x},${top + chartHeight} Z`);
        area.setAttribute('fill', 'url(#dashboard-trend-fill)');
        svg.appendChild(area);

        const line = createSvgElement('path');
        line.setAttribute('d', curvePath);
        line.setAttribute('class', 'dashboard-trend-line');
        svg.appendChild(line);
    }

    points.forEach(/** Append a plotted point and its value tooltip. */ (point) => {
        const circle = createSvgElement('circle');

        circle.setAttribute('cx', point.x);
        circle.setAttribute('cy', point.y);
        circle.setAttribute('r', '4');
        circle.setAttribute('class', 'dashboard-trend-point');

        const title = createSvgElement('title');

        title.textContent =
            `${formatTrendBucketLabel(
                point.bucket.bucket_start,
                dashboardState.period
            )}: ${formatTrendMetricValue(
                point.value,
                dashboardState.metric
            )}`;

        circle.appendChild(title);
        svg.appendChild(circle);

    });

    axisPoints.forEach(/** Append a label at an eligible bucket position. */ (point, index) => {
        const shouldRenderLabel =
            index % labelInterval === 0
            || index === axisPoints.length - 1;

        if (!shouldRenderLabel) return;

        const label = createSvgElement('text');

        label.setAttribute('x', point.x);
        label.setAttribute('y', height - 15);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('class', 'dashboard-trend-axis-label');

        label.textContent = formatTrendBucketLabel(
            point.bucket.bucket_start,
            dashboardState.period
        );

        svg.appendChild(label);
    });
}

/** Render summary, chart, and history or the empty-period state. */
function renderDashboardData() {
    if (!dashboardState.data) return;

    renderDashboardPeriod(
        dashboardState.data.period
    );

    if (
        dashboardState.data.summary.total_sessions === 0
    ) {
        dom.dashboard.dataContainer.style.display = 'none';
        dom.dashboard.emptyCTA.style.display = 'flex';
        updateBackToStatsButton();
        return;
    }

    dom.dashboard.dataContainer.style.display = 'block';
    dom.dashboard.emptyCTA.style.display = 'none';

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
function setupSessionsPaginationObserver() {
    if (dashboardState.sessionObserver) {
        dashboardState.sessionObserver.disconnect();
    }

    if (dashboardState.isLoading || !dashboardState.nextCursor) {
        dom.dashboard.sessionsLoadSentinel.style.display = 'none';
        return;
    }

    dom.dashboard.sessionsLoadSentinel.style.display = 'flex';
    if (dashboardState.paginationFailed) return;

    dashboardState.sessionObserver = new IntersectionObserver(
        /** Load another history page when the sentinel enters the viewport. */
        async (entries) => {
            if (!entries[0].isIntersecting) return;

            await loadMoreSessions();
        },
        {
            root: null,
            rootMargin: '300px'
        }
    );

    dashboardState.sessionObserver.observe(
        dom.dashboard.sessionsLoadSentinel
    );
}

/** Fetch and append the next session page for the current period. */
async function loadMoreSessions() {
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
    dom.dashboard.paginationRetryButton.hidden = true;
    dom.dashboard.paginationMessage.textContent = 'Loading more...';

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

        dom.dashboard.paginationMessage.textContent = '';
        renderSessionsByDate(dashboardState.sessions);

    } catch (error) {
        if (generation !== dashboardState.loadGeneration) return;
        console.error('Session pagination error:', error);
        dashboardState.paginationFailed = true;
        dashboardState.sessionObserver?.disconnect();
        dom.dashboard.paginationMessage.textContent = "Couldn't load more sessions.";
        dom.dashboard.paginationRetryButton.hidden = false;

    } finally {
        if (generation === dashboardState.loadGeneration) {
            dashboardState.isLoadingMore = false;
            if (!dashboardState.paginationFailed) setupSessionsPaginationObserver();
        }
    }
}

/** Toggle a history session's action menu. */
function toggleSessionMenu(event) {
    const toggleIcon = event.target.closest('.dashboard-session-open-menu-icon');
    if (!toggleIcon) return;
    const menu = toggleIcon.parentElement.querySelector('.dashboard-session-menu');
    const wasOpen = menu.style.display === 'flex';
    dom.dashboard.sessionsList.querySelectorAll('.dashboard-session-menu').forEach(/** Close other session menus before toggling the selected menu. */ (otherMenu) => {
        otherMenu.style.display = 'none';
    });
    menu.style.display = wasOpen ? 'none' : 'flex';
}

/** Close history menus when clicking outside their controls. */
function closeSessionMenusOnOutsideClick(event) {
    if (event.target.closest('.dashboard-session-menu, .dashboard-session-open-menu-icon')) return;
    dom.dashboard.sessionsList.querySelectorAll('.dashboard-session-menu').forEach(/** Close a history session menu. */ (menu) => {
        menu.style.display = 'none';
    });
}

/** Open feedback entry and record its originating screen. */
function openFeedbackForm(currentScreen) {
    if (!feedbackState.isSending) {
        dom.dashboard.feedbackMessage.textContent = '';
        dom.dashboard.feedbackMessage.classList.remove('feedback-success');
        dom.dashboard.feedbackInput.removeAttribute('aria-invalid');
    }
    feedbackState.currentScreen = currentScreen;
    if (isUserMenuOpened) toggleUserMenu(currentScreen);
    dom.dashboard.feedbackForm.style.display = 'flex';
}

/** Close feedback entry and clear its originating screen. */
function closeFeedbackForm() {
    feedbackState.currentScreen = null;
    dom.dashboard.feedbackForm.style.display = 'none';
}

/** Close feedback entry when clicking outside the form and open controls. */
function closeFeedbackFormOnOutsideClick(event) {
    if (dom.dashboard.feedbackForm.style.display !== 'flex') return;
    const clickedInsideForm = dom.dashboard.feedbackForm.contains(event.target);
    const clickedOpenButton = event.target.closest('[data-feedback-screen]');
    if (clickedInsideForm || clickedOpenButton) return;
    closeFeedbackForm();
}


// ========== APP WORKFLOWS ==========

/** Restore authentication and route to the appropriate initial screen. */
async function initializeApp() {
    try {
        const result = await refreshAccessToken();
        setAuthenticatedUser(result);
        initializeDashboardState();
        initializeStreakState();
    } catch (error) {
        showLoadingScreenError();
        return;
    }
    await routeToInitialScreen();
}

/** Restore work or retry a pending Finish after authentication. */
async function routeToInitialScreen(currentScreen = 'loading') {
    if (!accessToken) {
        navigateTo('register', 'loading');
        return;
    }
    let restoredSession = false;
    try {
        restoredSession = loadActiveSession(activeSessionState);
    } catch (error) {
        console.error('Could not restore the active session:', error);
        setDashboardSaveMessage('Couldn’t restore browser saves. Please reload to try again.');
    }
    if (restoredSession && pendingSubmission) {
        navigateTo('review', currentScreen);
        await handleFinishWork();
        return;
    }
    void syncOfflineWork();
    if (!restoredSession) {
        navigateTo('plan', currentScreen);
        await loadStreak('plan');
        return;
    }
    navigateTo('focus', currentScreen);
    dom.focus.pauseButton.textContent = 'Resume';
}

/** Return a mission or duration validation error, or an empty string. */
function validatePlan() {
    if (!dom.plan.mission.value.trim()) return 'Enter your mission.';
    if (dom.plan.mission.value.length > 50) return 'Keep your mission to 50 characters or fewer.';
    if (!dom.plan.targetTime.value || !/^\d{2}:\d{2}$/.test(dom.plan.targetTime.value)) {
        return 'Enter a focus time as HH:MM, for example 00:25.';
    }
    const [hours, minutes] = dom.plan.targetTime.value.split(':').map(Number);
    if (minutes > 59) return 'Enter minutes between 00 and 59.';
    if (hours === 0 && minutes === 0) return 'Choose a focus time greater than zero.';
    return '';
}

/** Validate the plan and start a timestamp-based work session. */
function handleStartWork() {
    dom.plan.missionError.textContent = '';
    dom.plan.timeError.textContent = '';
    dom.plan.mission.removeAttribute('aria-invalid');
    dom.plan.targetTime.removeAttribute('aria-invalid');
    const error = validatePlan();
    if (error) {
        const isMissionError = !dom.plan.mission.value.trim() || dom.plan.mission.value.length > 50;
        const input = isMissionError ? dom.plan.mission : dom.plan.targetTime;
        const message = isMissionError ? dom.plan.missionError : dom.plan.timeError;
        message.textContent = error;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
    }
    activeSessionState.currentMission = dom.plan.mission.value;
    activeSessionState.targetTimeSeconds = parseHHMMToSeconds(dom.plan.targetTime.value);
    activeSessionState.startTimestamp = new Date().toISOString();
    navigateTo('focus', 'plan');
    startTimer(activeSessionState);
}

/** Toggle the active session between paused and running states. */
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

/** Stop the active session and open Review. */
function handleStopWork() {
    stopSession(activeSessionState);
    navigateTo('review', 'focus');
}

/** Resume reviewed work when no submission is pending. */
function handleContinueWork() {
    if (isFinishingSession || pendingSubmission) return;
    dom.review.saveMessage.textContent = '';
    navigateTo('focus', 'review');
    dom.focus.pauseButton.textContent = 'Pause';
    resumeSession(activeSessionState);
}

/** Clear completed work state and reset mission controls. */
function resetApp() {
    pendingSubmission = null;
    resetSessionState(activeSessionState);
    dom.plan.mission.value = '';
    dom.plan.targetTime.value = '00:00';
    dom.focus.currentTime.textContent = '00:00:00';
    dom.focus.timerRing.style.setProperty('--pct', '0%');
    try {
        clearActiveSession();
    } catch (error) {
        console.error('Could not clear the saved active session:', error);
    }
    dom.review.continueButton.classList.replace('normal-button', 'cta-button');
}

/** Save or queue the exact submission and show its outcome on Dashboard. */
async function handleFinishWork() {
    if (isFinishingSession) return;
    const userId = authenticatedUserId;
    if (userId == null) {
        dom.review.saveMessage.textContent = 'Please sign in before saving this session.';
        return;
    }
    isFinishingSession = true;
    const feedbackStartedAt = performance.now();
    dom.review.finishButton.disabled = true;
    dom.review.continueButton.disabled = true;
    dom.review.finishButton.textContent = pendingSubmission ? 'Retrying…' : 'Saving…';
    dom.review.screen.setAttribute('aria-busy', 'true');
    dom.review.saveMessage.textContent = '';
    pendingSubmission ??= {
        submissionId: crypto.randomUUID(),
        date: new Date().toISOString(),
        mission: activeSessionState.currentMission,
        targetTimeSeconds: activeSessionState.targetTimeSeconds,
        actualTimeSeconds: activeSessionState.actualTimeSeconds
    };
    let queued = false;
    let saved = false;
    try {

        try {
            saveActiveSession(activeSessionState);
        } catch (error) {
            console.error('Could not persist the active session:', error);
        }
        try {
            await sessionQueue.add(userId, pendingSubmission);
            queued = true;
        } catch (error) {
            console.error('Could not queue session:', error);
        }
        if (authenticatedUserId !== userId) return;
        try {
            await postSession(pendingSubmission, userId);
            if (authenticatedUserId !== userId) return;
            saved = true;
        } catch (error) {
            if (authenticatedUserId !== userId) return;
            console.error('Save error:', error);
            const rejected = error.status >= 400 && error.status < 500
                && ![401, 403, 408, 429].includes(error.status);
            if (rejected) {
                if (queued) await sessionQueue.remove(userId, pendingSubmission.submissionId);
                pendingSubmission = null;
                try {
                    saveActiveSession(activeSessionState);
                } catch (storageError) {
                    console.error('Could not update active session:', storageError);
                }
                dom.review.saveMessage.textContent = 'The server rejected this session. Your work is still here. Try again.';
                return;
            }
            if (!queued) {
                dom.review.saveMessage.textContent = 'Couldn’t save to the server or browser queue. Your work is still here. Try again.';
                return;
            }
        }
        if (saved && queued) {
            try {
                await sessionQueue.remove(userId, pendingSubmission.submissionId);
            } catch (error) {

                console.error('Could not remove synced session:', error);
            }
        }
        await waitForMinimumFeedback(feedbackStartedAt);
        if (authenticatedUserId !== userId) return;
        resetApp();
        navigateTo('dashboard', 'review');
        setDashboardSaveMessage(saved
            ? 'Session saved. Nice work.'
            : 'Saved on this browser. Waiting to sync. Dashboard totals update after syncing.', { saved });
        await loadDashboard();
    } catch (error) {
        console.error('Could not finish session:', error);
        dom.review.saveMessage.textContent = 'Couldn’t finish saving. Your work is still here. Try again.';
    } finally {
        await waitForMinimumFeedback(feedbackStartedAt);
        isFinishingSession = false;
        dom.review.finishButton.disabled = false;
        dom.review.continueButton.disabled = pendingSubmission !== null;
        dom.review.finishButton.textContent = pendingSubmission ? 'Try again' : 'Finish';
        dom.review.screen.removeAttribute('aria-busy');
    }
}

/** Load period data and sessions while ignoring superseded results. */
async function loadDashboard(feedbackStartedAt = null) {
    const generation = ++dashboardState.loadGeneration;
    const period = dashboardState.period;
    const anchorDate = dashboardState.anchorDates[period];
    dashboardState.isLoading = true;
    dashboardState.isLoadingMore = false;
    dashboardState.paginationFailed = false;
    dom.dashboard.paginationMessage.textContent = '';
    dom.dashboard.paginationRetryButton.hidden = true;
    dashboardState.sessionObserver?.disconnect();
    dom.dashboard.sessionsLoadSentinel.style.display = 'none';
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
        dom.dashboard.error.style.display = 'none';
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

/** Clear validation messages and invalid-field markers on both auth forms. */
function clearAuthValidationFeedback() {
    [dom.register.form, dom.login.form].forEach(/** Clear validation feedback for an authentication form. */ (form) => {
        form.querySelectorAll('.form-error-message').forEach(/** Clear an authentication error message. */ (error) => {
            error.textContent = '';
        });
        form.querySelectorAll('[aria-invalid]').forEach(/** Remove an authentication input invalid marker. */ (input) => {
            input.removeAttribute('aria-invalid');
        });
    });
}

/** Display a field error and mark its input invalid. */
function showAuthFieldError(input, errorElement, message) {
    errorElement.textContent = message;
    input.setAttribute('aria-invalid', 'true');
}

/** Validate registration fields and submit account creation with loading feedback. */
async function handleRegister(event) {
    event.preventDefault();
    if (dom.register.submitButton.disabled) return;
    dom.register.error.textContent = '';
    [dom.register.emailError, dom.register.usernameError, dom.register.passwordError].forEach(/** Clear a registration field error. */ (error) => {
        error.textContent = '';
    });
    [dom.register.email, dom.register.username, dom.register.password].forEach(/** Remove a registration input invalid marker. */ (input) => {
        input.removeAttribute('aria-invalid');
    });
    let firstInvalid = null;
    /** Record a registration field error and preserve the first invalid input. */
    const invalid = (input, error, message) => {
        showAuthFieldError(input, error, message);
        firstInvalid ??= input;
    };
    const email = dom.register.email.value;
    if (!email) invalid(dom.register.email, dom.register.emailError, 'Enter your email.');
    else if (!email.includes('@')) invalid(dom.register.email, dom.register.emailError, 'Include @ in your email.');
    else if (!email.split('@')[1]) invalid(dom.register.email, dom.register.emailError, 'Add the address after @.');
    else if (dom.register.email.validity.typeMismatch) invalid(dom.register.email, dom.register.emailError, 'Enter a valid email, like name@example.com.');
    if (!dom.register.username.value) invalid(dom.register.username, dom.register.usernameError, 'Enter your username.');
    const passwordError = getPasswordError(dom.register.password.value);
    if (passwordError) invalid(dom.register.password, dom.register.passwordError, passwordError);
    if (firstInvalid) {
        firstInvalid.focus();
        return;
    }
    dom.register.submitButton.disabled = true;
    dom.register.submitButton.textContent = 'Creating account...';
    dom.register.form.setAttribute('aria-busy', 'true');
    try {
        const result = await register(dom.register.username.value, email, dom.register.password.value);
        if (result.success === true) {
            setAuthenticatedUser(result);
            await routeToInitialScreen('register');
        } else if (result.status === 409) {
            dom.register.error.textContent = 'Email or username is already in use.';
        } else {
            dom.register.error.textContent = "Couldn't create your account. Please try again.";
        }
    } catch (error) {
        dom.register.error.textContent = "Couldn't reach the server. Try again.";
    } finally {
        dom.register.submitButton.disabled = false;
        dom.register.submitButton.textContent = 'Register';
        dom.register.form.removeAttribute('aria-busy');
    }
}

/** Validate login fields and submit credentials with loading feedback. */
async function handleLogin(event) {
    event.preventDefault();
    if (dom.login.submitButton.disabled) return;
    dom.login.error.textContent = '';
    dom.login.identifierError.textContent = '';
    dom.login.passwordError.textContent = '';
    dom.login.usernameOrEmail.removeAttribute('aria-invalid');
    dom.login.password.removeAttribute('aria-invalid');
    let firstInvalid = null;
    if (!dom.login.usernameOrEmail.value) {
        showAuthFieldError(dom.login.usernameOrEmail, dom.login.identifierError, 'Enter your username or email.');
        firstInvalid = dom.login.usernameOrEmail;
    }
    if (!dom.login.password.value) {
        showAuthFieldError(dom.login.password, dom.login.passwordError, 'Enter your password.');
        firstInvalid ??= dom.login.password;
    }
    if (firstInvalid) {
        firstInvalid.focus();
        return;
    }
    dom.login.submitButton.disabled = true;
    dom.login.submitButton.textContent = 'Logging in...';
    dom.login.form.setAttribute('aria-busy', 'true');
    try {
        const result = await login(dom.login.usernameOrEmail.value, dom.login.password.value);
        if (result.success === true) {
            setAuthenticatedUser(result);
            await routeToInitialScreen('login');
        } else if (result.status === 401) {
            dom.login.error.textContent = 'Username, email or password is incorrect.';
        } else {
            dom.login.error.textContent = "Couldn't log in. Please try again.";
        }
    } catch (error) {
        dom.login.error.textContent = "Couldn't reach the server. Try again.";
    } finally {
        dom.login.submitButton.disabled = false;
        dom.login.submitButton.textContent = 'Login';
        dom.login.form.removeAttribute('aria-busy');
    }
}

/** End the authenticated session and return to registration. */
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

/** Apply the target-duration input's keyboard behavior. */
function handleTargetTimeKeydown(event) {
    const allowedKeys = /^\d$/.test(event.key) || event.key === 'Backspace';
    if (!allowedKeys) return;
    event.preventDefault();
    let caretPosition = dom.plan.targetTime.selectionStart;
    if (caretPosition === null || caretPosition === 0) return;
    if (caretPosition === 3) caretPosition = 2;
    const digitPosition = caretPosition - 1;
    const replacement = event.key === 'Backspace' ? '0' : event.key;
    const previousValue = dom.plan.targetTime.value;
    const characters = dom.plan.targetTime.value.split('');
    characters[digitPosition] = replacement;
    dom.plan.targetTime.value = characters.join('');
    dom.plan.targetTime.setSelectionRange(caretPosition, caretPosition);
    if (dom.plan.targetTime.value !== previousValue) {
        dom.plan.targetTime.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/** Delete the selected history session and reload Dashboard data. */
async function handleDeleteSession(event) {
    const deleteButton = event.target.closest('.dashboard-delete-session-btn');
    if (!deleteButton || deleteButton.disabled) return;
    if (!confirm('Delete this session?')) return;
    const menu = deleteButton.closest('.dashboard-session-menu');
    menu.querySelector('.form-error-message')?.remove();
    deleteButton.disabled = true;
    deleteButton.textContent = 'Deleting…';
    try {
        const result = await deleteSession(deleteButton.dataset.sessionId);
        if (!result.success) throw new Error('Deletion failed');
        await loadDashboard();
    } catch (error) {
        const message = document.createElement('p');
        message.className = 'form-error-message';
        message.setAttribute('role', 'alert');
        message.textContent = 'Couldn’t delete this session. Try again.';
        menu.appendChild(message);
    } finally {
        deleteButton.disabled = false;
        deleteButton.textContent = 'Delete Session';
    }
}

/** Open Dashboard from Plan and load its data. */
async function handleOpenDashboard() {
    navigateTo('dashboard', 'plan');
    await loadDashboard();
}

/** Validate and submit feedback with request-state controls. */
async function handleSubmitFeedback(event) {
    event.preventDefault();
    if (feedbackState.isSending) return;

    const feedbackInput = dom.dashboard.feedbackInput;
    const sendButton = dom.dashboard.sendFeedbackButton;
    const message = dom.dashboard.feedbackMessage;
    message.classList.remove('feedback-success');
    feedbackInput.removeAttribute('aria-invalid');
    message.textContent = '';

    if (!feedbackInput.value.trim() || feedbackInput.value.length > 2000) {
        message.textContent = !feedbackInput.value.trim()
            ? 'Write a message before sending.'
            : 'Keep your message to 2,000 characters or fewer.';
        feedbackInput.setAttribute('aria-invalid', 'true');
        feedbackInput.focus();
        return;
    }

    feedbackState.isSending = true;
    sendButton.disabled = true;
    sendButton.textContent = 'Sending…';
    feedbackInput.readOnly = true;
    dom.dashboard.feedbackForm.setAttribute('aria-busy', 'true');
    try {
        const result = await postFeedback(feedbackInput.value, feedbackState.currentScreen);
        if (result.success !== true) {
            message.textContent = result.status === 400
                ? 'Check your message and try sending it again.'
                : 'Couldn’t send your feedback. Please try again.';
            return;
        }
        message.textContent = 'Feedback sent. Thank you!';
        message.classList.add('feedback-success');
        feedbackInput.value = '';
        feedbackInput.style.height = '';
    } catch (error) {
        message.textContent = 'Couldn’t reach the server. Your message is still here—try again.';
    } finally {
        feedbackState.isSending = false;
        sendButton.disabled = false;
        sendButton.textContent = 'Send Feedback';
        feedbackInput.readOnly = false;
        dom.dashboard.feedbackForm.removeAttribute('aria-busy');
    }
}

/** Resize feedback input to fit its content. */
function handleFeedbackInput() {
    const input = dom.dashboard.feedbackInput;
    input.removeAttribute('aria-invalid');
    dom.dashboard.feedbackMessage.textContent = '';
    dom.dashboard.feedbackMessage.classList.remove('feedback-success');
    input.style.overflowY = 'hidden';
    input.style.height = 'auto';
    const borderHeight = input.offsetHeight - input.clientHeight;
    input.style.height = `${input.scrollHeight + borderHeight}px`;
    if (input.scrollHeight > input.clientHeight + 1) {
        input.style.overflowY = 'auto';
    }
}

/** Return from Dashboard to mission planning. */
function handleDashboardToPlan() {
    navigateTo('plan', 'dashboard');
    if (dom.dashboard.feedbackForm.style.display === 'flex') closeFeedbackForm();
}

/** Select a Dashboard period and reload its data. */
async function handleDashboardPeriodChange(event) {
    const button = event.target.closest(
        '[data-dashboard-period]'
    );

    if (!button) return;

    const newPeriod = button.dataset.dashboardPeriod;

    dashboardState.period = newPeriod;
    initializeDashboardState();

    await loadDashboard();
}

/** Move to the adjacent Dashboard period and reload its data. */
async function handleDashboardPeriodNavigation(direction) {
    if (dashboardState.period === 'all_time') return;

    dashboardState.anchorDates[dashboardState.period] = shiftPeriodAnchor(
        dashboardState.period,
        dashboardState.anchorDates[dashboardState.period],
        direction
    );

    await loadDashboard();
}

/** Select a trend metric and redraw the chart. */
function handleDashboardMetricChange(event) {
    const button = event.target.closest(
        '[data-dashboard-metric]'
    );

    if (!button) return;

    dashboardState.metric =
        button.dataset.dashboardMetric;

    renderTrendMetricButtons();
    renderTrendChart();
}

/** Build the consistency calendar and its month navigation controls. */
function renderStreakPopup(screen, data, { isLoading = false, failed = false } = {}) {
    const popup = dom[screen].streakPopup;

    popup.innerHTML = '';

    const header = document.createElement('div');
    const previousButton = document.createElement('button');
    const title = document.createElement('p');
    const nextButton = document.createElement('button');

    header.className = 'streak-calendar-header';
    previousButton.type = 'button';
    nextButton.type = 'button';
    previousButton.setAttribute('aria-label', 'Previous month');
    nextButton.setAttribute('aria-label', 'Next month');
    previousButton.textContent = '<';
    nextButton.textContent = '>';

    const monthDate = parseLocalDate(
        `${data.calendar.month}-01`
    );

    title.textContent = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric'
    }).format(monthDate);

    header.append(
        previousButton,
        title,
        nextButton
    );

    popup.appendChild(header);

    previousButton.addEventListener('click', /** Show the previous calendar month. */ () => {
        streakState.anchorDate = shiftMonthAnchor(streakState.anchorDate, -1);
        void loadStreak(screen);
    });
    nextButton.addEventListener('click', /** Show the next calendar month. */ () => {
        streakState.anchorDate = shiftMonthAnchor(streakState.anchorDate, 1);
        void loadStreak(screen);
    });

    if (failed) {
        const error = document.createElement('div');
        error.className = 'streak-calendar-error';
        const message = document.createElement('p');
        message.setAttribute('role', 'alert');
        message.textContent = 'Couldn’t load this month. Try again.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'normal-button';
        retry.textContent = 'Retry';
        retry.addEventListener('click', /** Retry the selected calendar month. */ () => {
            void loadStreak(screen);
        });
        error.append(message, retry);
        popup.appendChild(error);
        return;
    }

    const calendar = document.createElement('div');
    calendar.className = 'streak-calendar';
    calendar.setAttribute('aria-busy', String(isLoading));
    if (isLoading) calendar.setAttribute('aria-label', 'Loading calendar');

    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(
        /** Append a weekday heading to the consistency calendar. */
        (weekday) => {
            const label = document.createElement('span');
            label.textContent = weekday;
            calendar.appendChild(label);
        }
    );

    const firstDay = parseLocalDate(
        data.calendar.days[0].date
    );

    const emptyCellsBeforeFirstDay =
        (firstDay.getDay() + 6) % 7;

    for (
        let index = 0;
        index < emptyCellsBeforeFirstDay;
        index++
    ) {
        calendar.appendChild(
            document.createElement('span')
        );
    }

    data.calendar.days.forEach(/** Append a day with its work, rest, or neutral state. */ (day) => {
        const dayElement = document.createElement('span');
        const visualState = day.state === 'work' || day.state === 'rest'
            ? day.state
            : 'neutral';

        dayElement.className =
            `streak-calendar-day streak-calendar-day-${visualState}`;

        dayElement.textContent =
            String(parseLocalDate(day.date).getDate());

        if (isLoading) dayElement.setAttribute('aria-hidden', 'true');
        else dayElement.title = visualState;

        calendar.appendChild(dayElement);
    });

    popup.appendChild(calendar);
    if (isLoading) {
        const footer = document.createElement('div');
        footer.className = 'dashboard-skeleton streak-calendar-loading-footer';
        footer.setAttribute('aria-hidden', 'true');
        popup.appendChild(footer);
        return;
    }

    const legend = document.createElement('div');
    legend.className = 'streak-calendar-legend';
    for (const [state, label] of [['work', 'Work'], ['rest', 'Rest']]) {
        const item = document.createElement('div');
        const marker = document.createElement('span');
        const text = document.createElement('span');
        marker.className = `streak-calendar-legend-marker streak-calendar-day-${state}`;
        marker.setAttribute('aria-hidden', 'true');
        text.textContent = label;
        item.append(marker, text);
        legend.appendChild(item);
    }
    popup.appendChild(legend);

    const restDays = document.createElement('p');
    restDays.className = 'streak-calendar-rest-days';
    const remaining = data.rest_days_remaining_this_week;

    restDays.textContent =
        `${remaining} rest ${remaining === 1 ? 'day' : 'days'} remaining this week.`;

    popup.appendChild(restDays);
}

/** Update streak values and calendars on Plan and Dashboard. */
function renderStreak(data) {
    for (const screen of ['plan', 'dashboard']) {
        dom[screen].streakButton.textContent =
            `🔥 ${data.current_streak}`;

        renderStreakPopup(screen, data);
    }
}

/** Fetch and render streak information for the current calendar selection. */
async function loadStreak(currentScreen) {
    const generation = ++streakState.loadGeneration;
    const anchorDate = streakState.anchorDate;
    const month = parseLocalDate(anchorDate);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const pendingData = {
        calendar: {
            month: anchorDate.slice(0, 7),
            days: Array.from({ length: daysInMonth }, /** Create a neutral placeholder for each calendar day. */ (_, index) => ({
                date: `${anchorDate.slice(0, 7)}-${String(index + 1).padStart(2, '0')}`,
                state: 'neutral'
            }))
        }
    };
    for (const screen of ['plan', 'dashboard']) {
        renderStreakPopup(screen, pendingData, { isLoading: true });
    }
    try {
        const result = await fetchStreak(
            anchorDate,
            currentScreen
        );
        if (generation !== streakState.loadGeneration) return;

        if (!result.success) {
            throw new Error(result.error);
        }

        streakState.data = result;
        renderStreak(result);

    } catch (error) {
        if (generation !== streakState.loadGeneration) return;
        console.error('Streak loading error:', error);
        for (const screen of ['plan', 'dashboard']) {
            renderStreakPopup(screen, pendingData, { failed: true });
        }
    }
}

/** Toggle the selected screen's consistency calendar. */
function toggleStreakPopup(screen) {
    const isOpen =
        streakState.openScreen === screen;

    dom.plan.streakPopup.style.display = 'none';
    dom.dashboard.streakPopup.style.display = 'none';

    if (isOpen) {
        streakState.openScreen = null;
        return;
    }

    dom[screen].streakPopup.style.display = 'block';
    streakState.openScreen = screen;
}

/** Close the consistency calendar on outside clicks. */
function closeStreakPopupsOnOutsideClick(event) {
    if (!streakState.openScreen) return;

    const screen = streakState.openScreen;
    const clickPath = event.composedPath();

    if (
        clickPath.includes(dom[screen].streakPopup)
        || clickPath.includes(dom[screen].streakButton)
    ) {
        return;
    }

    dom[screen].streakPopup.style.display = 'none';
    streakState.openScreen = null;
}


// ========== EVENT WIRING ==========

/** Connect application controls and browser events to their handlers. */
function registerEventListeners() {
    window.addEventListener('scroll', updateBackToStatsButton, { passive: true });
    window.addEventListener('resize', updateBackToStatsButton);
    dom.dashboard.backToStatsButton.addEventListener('click', handleBackToStats);
    window.addEventListener('online', /** Retry queued submissions when connectivity returns. */ () => { void syncOfflineWork(); });
    dom.loading.retryButton.addEventListener('click', /** Retry application initialization. */ async () => {
        if (dom.loading.retryButton.disabled) return;
        dom.loading.retryButton.disabled = true;
        dom.loading.retryButton.textContent = 'Retrying…';
        showLoadingSpinner();
        try {
            await initializeApp();
        } finally {
            dom.loading.retryButton.disabled = false;
            dom.loading.retryButton.textContent = 'Retry';
        }
    });

    for (const [input, message] of [[dom.plan.mission, dom.plan.missionError], [dom.plan.targetTime, dom.plan.timeError]]) {
        input.addEventListener('input', /** Clear a plan field error when its value changes. */ () => {
            message.textContent = '';
            input.removeAttribute('aria-invalid');
        });
    }

    dom.passwordButtons.forEach(/** Attach a password visibility handler. */ (button) => {
        button.addEventListener('click', /** Toggle the associated password field visibility. */ () => {
            const passwordInput = button.parentElement.querySelector('.input');
            togglePasswordVisibility(passwordInput, button);
        });
    });

    dom.register.switchToLoginButton.addEventListener('click', /** Clear auth feedback and switch to Login. */ () => {
        clearAuthValidationFeedback();
        hidePassword(dom.register.password);
        navigateTo('login', 'register');
    });
    dom.login.switchToRegisterButton.addEventListener('click', /** Clear auth feedback and switch to Register. */ () => {
        clearAuthValidationFeedback();
        hidePassword(dom.login.password);
        navigateTo('register', 'login');
    });
    [[dom.register.email, dom.register.emailError],
        [dom.register.username, dom.register.usernameError],
        [dom.register.password, dom.register.passwordError],
        [dom.login.usernameOrEmail, dom.login.identifierError],
        [dom.login.password, dom.login.passwordError]].forEach(/** Attach an input handler to clear a field validation error. */ ([input, error]) => {
        input.addEventListener('input', /** Clear the edited field error and invalid marker. */ () => {
            error.textContent = '';
            input.removeAttribute('aria-invalid');
        });
    });
    [dom.register.email, dom.register.username, dom.register.password].forEach(/** Attach a handler to clear registration request errors. */ (input) => {
        input.addEventListener('input', /** Clear the registration request error after editing. */ () => { dom.register.error.textContent = ''; });
    });
    [dom.login.usernameOrEmail, dom.login.password].forEach(/** Attach a handler to clear login request errors. */ (input) => {
        input.addEventListener('input', /** Clear the login request error after editing. */ () => { dom.login.error.textContent = ''; });
    });
    dom.register.form.addEventListener('submit', handleRegister);
    dom.login.form.addEventListener('submit', handleLogin);

    dom.plan.userIcon.addEventListener('click', /** Toggle the Plan account menu. */ () => toggleUserMenu('plan'));
    dom.dashboard.userIcon.addEventListener('click', /** Toggle the Dashboard account menu. */ () => toggleUserMenu('dashboard'));
    dom.plan.logoutButton.addEventListener('click', /** Log out from Plan. */ () => handleLogout('plan'));
    dom.dashboard.logoutButton.addEventListener('click', /** Log out from Dashboard. */ () => handleLogout('dashboard'));
    document.addEventListener('click', closeUserMenusOnOutsideClick);

    dom.plan.targetTime.addEventListener('keydown', handleTargetTimeKeydown);
    dom.plan.dashboardButton.addEventListener('click', handleOpenDashboard);
    dom.plan.startButton.addEventListener('click', handleStartWork);
    dom.focus.pauseButton.addEventListener('click', handlePauseResume);
    dom.focus.stopButton.addEventListener('click', handleStopWork);
    dom.review.continueButton.addEventListener('click', handleContinueWork);
    dom.review.finishButton.addEventListener('click', handleFinishWork);

    dom.dashboard.periodButtons.forEach(/** Attach a period selection handler. */ (button) => {
        button.addEventListener('click', handleDashboardPeriodChange);
    });
    dom.dashboard.previousPeriodButton.addEventListener('click', /** Show the previous Dashboard period. */ () => handleDashboardPeriodNavigation(-1));
    dom.dashboard.nextPeriodButton.addEventListener('click', /** Show the next Dashboard period. */ () => handleDashboardPeriodNavigation(1));
    dom.dashboard.metricButtons.forEach(/** Attach a trend metric selection handler. */ (button) => {
        button.addEventListener('click', handleDashboardMetricChange);
    });
    dom.plan.streakButton.addEventListener('click', /** Toggle the Plan consistency calendar. */ () => toggleStreakPopup('plan'));
    dom.dashboard.streakButton.addEventListener('click', /** Toggle the Dashboard consistency calendar. */ () => toggleStreakPopup('dashboard'));
    document.addEventListener('click', closeStreakPopupsOnOutsideClick);

    dom.dashboard.paginationRetryButton.addEventListener('click', /** Retry the failed history page request. */ () => {
        if (dashboardState.isLoading || dashboardState.isLoadingMore) return;
        dashboardState.paginationFailed = false;
        loadMoreSessions();
    });
    dom.dashboard.retryButton.addEventListener('click', /** Retry queued saves and Dashboard loading with minimum feedback duration. */ async () => {
        if (dashboardState.isLoading || dom.dashboard.retryButton.disabled) return;
        const feedbackStartedAt = performance.now();
        dom.dashboard.retryButton.disabled = true;
        dom.dashboard.retryButton.textContent = 'Retrying…';
        try {
            await Promise.all([syncOfflineWork(), loadDashboard(feedbackStartedAt)]);
        } finally {
            await waitForMinimumFeedback(feedbackStartedAt);
            dom.dashboard.retryButton.disabled = false;
            dom.dashboard.retryButton.textContent = 'Retry';
        }
    });
    dom.dashboard.newMissionButton.addEventListener('click', handleDashboardToPlan);
    dom.dashboard.emptyStartButton.addEventListener('click', handleDashboardToPlan);
    dom.dashboard.sessionsList.addEventListener('click', toggleSessionMenu);
    document.addEventListener('click', closeSessionMenusOnOutsideClick);
    dom.dashboard.sessionsList.addEventListener('click', handleDeleteSession);

    document.querySelectorAll('[data-feedback-screen]').forEach(/** Attach a feedback-opening handler. */ (button) => {
        button.addEventListener('click', /** Open feedback from the selected screen. */ () => {
            openFeedbackForm(button.dataset.feedbackScreen);
        });
    });
    dom.dashboard.closeFeedbackButton.addEventListener('click', closeFeedbackForm);
    dom.dashboard.feedbackForm.addEventListener('submit', handleSubmitFeedback);
    dom.dashboard.feedbackInput.addEventListener('input', handleFeedbackInput);
    document.addEventListener('click', closeFeedbackFormOnOutsideClick);
}


// ========== INITIALIZATION ==========

registerEventListeners();
document.addEventListener('DOMContentLoaded', /** Initialize the application after the document is ready. */ async () => {
    await initializeApp();
});
