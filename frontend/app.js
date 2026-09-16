// ========== 1. CONSTANTS ==========

let BACKEND_URL = '';
if (window.location.hostname === "executionos-mvp.netlify.app") {
    BACKEND_URL = 'https://executionos.onrender.com';
}
else if (window.location.hostname === "localhost") {
    BACKEND_URL = 'https://localhost:5000';
}

const DATE_TO_MONTHS = {
    '1': 'Jan',
    '2': 'Feb',
    '3': 'Mar',
    '4': 'Apr',
    '5': 'May',
    '6': 'Jun',
    '7': 'Jul',
    '8': 'Aug',
    '9': 'Sep',
    '10': 'Oct',
    '11': 'Nov',
    '12': 'Dec'
}

const NUMBER_TO_WEEKDAY = {
    '0': 'Sun',
    '1': 'Mon',
    '2': 'Tue',
    '3': 'Wed',
    '4': 'Thu',
    '5': 'Fri',
    '6': 'Sat'
}

// ========== 2. STATE & MANAGERS ==========


let accessToken = null;

let isUserMenuOpened = false;

const QueueManager = {
    queue: [],
    cap: 15,
    storageKey: 'executionOS_sessionQueue',

    loadQueue: function() {
        const stored = localStorage.getItem(this.storageKey);
        this.queue = stored ? JSON.parse(stored) : [];
    },

    saveQueue: function() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    },

    addToQueue: function(item) {
        if (this.queue.length >= this.cap) {
            return false;
        }
        this.queue.push(item);
        this.saveQueue();
        return true;
    },

    removeFirst: function() {
        this.queue.shift();
        this.saveQueue();
    }
};

const AppState = {
    currentMission: '',
    targetTimeSeconds: 0,
    actualTimeSeconds: 0,
    completionStatus: 'partial',
    percentageCompleted: 0,
    isTimerRunning: false,
    startTimestamp: '',
    pauseStartTimestamp: '',
    pausedTimeSeconds: 0
}

let timerInterval = null;


// ========== 3. DOM ELEMENT REFERENCES ==========


// loading screen
const loadingScreen = document.querySelector('.loading-screen');
const loadingIcon = document.getElementById('loading-icon');
const loadingErrorMessage = document.getElementById('loading-error-message');
const loadingRetryBtn = document.getElementById('loading-retry-btn');

// register screen
const registerScreen = document.querySelector('.register-screen');
const registerForm = document.getElementById('register-form');
const registerUsernameInput = document.getElementById('register-username-input');
const registerEmailInput = document.getElementById('register-email-input');
const registerPasswordInput = document.getElementById('register-password-input');
const registerPasswordErrorMessage = document.getElementById('register-password-error-message');
const registerSubmitBtn = document.getElementById('register-submit-btn');
const registerErrorMessage = document.getElementById('register-error-message');
const registerSwitchToLoginBtn = document.getElementById('register-switch-to-login-btn');

// login screen
const loginScreen = document.querySelector('.login-screen');
const loginForm = document.getElementById('login-form');
const loginUsernameOrEmailInput = document.getElementById('login-username-or-email-input');
const loginPasswordInput = document.getElementById('login-password-input');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginErrorMessage = document.getElementById('login-error-message');
const loginSwitchToRegisterBtn = document.getElementById('login-switch-to-register-btn');

// plan screen
const planScreen = document.querySelector('.plan-screen');
const planUserIcon = document.getElementById('plan-user-icon');
const planUserMenu = document.getElementById('plan-user-menu');
const planUserMenuUsername = document.getElementById('plan-user-menu-username');
const planUserMenuIcon = document.getElementById('plan-user-menu-icon');
const planUserMenuLogoutBtn = document.getElementById('plan-user-menu-logout-btn');

const planMissionInput = document.getElementById('plan-mission-input');
const planTargetTimeInput = document.getElementById('plan-target-time-input');
const planDashboardBtn = document.getElementById('plan-dashboard-btn');
const planStartWorkBtn = document.getElementById('plan-start-work-btn');

// focus screen
const focusScreen = document.querySelector('.focus-screen');
const focusTimerRingContainer = document.getElementById('focus-timer-ring-container');
const focusMissionDisplay = document.getElementById('focus-mission-display');
const focusTargetTimeDisplay = document.getElementById('focus-target-time-display');
const focusCurrentTimeDisplay = document.getElementById('focus-current-time-display');
const focusPauseBtn = document.getElementById('focus-pause-btn');
const focusStopBtn = document.getElementById('focus-stop-btn');

// review screen
const reviewScreen = document.querySelector('.review-screen');
const reviewMissionDisplay = document.getElementById('review-mission-display');
const reviewTargetTimeDisplay = document.getElementById('review-target-time-display');
const reviewProgressRingContainer = document.getElementById('review-progress-ring-container');
const reviewCompletionPercentageDisplay = document.getElementById('review-completion-percentage-display');
const reviewCompletionStatusDisplay = document.getElementById('review-completion-status-display');
const reviewActualTimeDisplay = document.getElementById('review-actual-time-display');
const reviewContinueBtn = document.getElementById('review-continue-btn');
const reviewFinishBtn = document.getElementById('review-finish-btn');

// dashboard screen
const dashboardScreen = document.querySelector('.dashboard-screen');

const dashboardNewMissionBtn = document.getElementById('dashboard-new-mission-btn');

const dashboardUserIcon = document.getElementById('dashboard-user-icon');
const dashboardUserMenu = document.getElementById('dashboard-user-menu');
const dashboardUserMenuUsername = document.getElementById('dashboard-user-menu-username');
const dashboardUserMenuIcon = document.getElementById('dashboard-user-menu-icon');
const dashboardUserMenuLogoutBtn = document.getElementById('dashboard-user-menu-logout-btn');

const dashboardContent = document.getElementById('dashboard-content');
const dashboardLoading = document.getElementById("dashboard-loading");
const dashboardWeeklyStatsContainer = document.getElementById('dashboard-weekly-stats-container');
const dashboardAmountOfSessionsDisplay = document.getElementById('dashboard-amount-of-sessions-display');
const dashboardAveragePercentageDisplay = document.getElementById('dashboard-average-percentage-display');
const dashboardTotalTimeDisplay = document.getElementById('dashboard-total-time-display');
const dashboardSessionsListContainer = document.getElementById("dashboard-sessions-list-container");
const emptyDashboardCTAContainer = document.getElementById("empty-dashboard-cta-container");
const emptyDashboardStartMissionBtn = document.getElementById("empty-dashboard-start-mission-btn");


// general
const passwordVisibilityButtons = document.querySelectorAll('.password-visibility-btn');


// ========== 4. UTILITY FUNCTIONS ==========

async function initiateApp() {
    try {
        const result = await refreshAccessToken();
        accessToken = result.access_token;
        planUserMenuUsername.textContent = result.username;
        dashboardUserMenuUsername.textContent = result.username;
    } catch (error) {
        showLoadingScreenError();
        return;
    }
    await routeToInitialScreen();
}

async function routeToInitialScreen() {
    if (!accessToken) {
        changeToRegisterScreen("loading");
        return;
    }
    syncOfflineWork();
    const loadedActiveSession = loadActiveSession(AppState);
    if (!loadedActiveSession) {
        changeToPlanScreen("loading");
        return;
    }
    alert("Returning to uncompleted session...");
    changeToFocusScreen(AppState, "loading");
}

async function syncOfflineWork() {
    QueueManager.loadQueue();
    if (QueueManager.queue.length > 0) {
        alert("Syncing offline work...");
        await retryQueue();
    }
}


function parseTimeFromHHMM(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    return hours * 3600 + minutes * 60;
}

function formatTime(totalSeconds) {
    const hours = Math.floor(Number(totalSeconds) / 3600);
    const minutes = Math.floor((Number(totalSeconds) % 3600) / 60);
    const seconds = Number(totalSeconds) % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatTimeTohm(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
}

function startTimer(appState) {
    appState.isTimerRunning = true;
    timerInterval = setInterval(updateTimer.bind(null, appState), 1000);
}

function updateTimer(appState) {
    if (!appState.isTimerRunning) return;
    const elapsed = Math.floor(((Date.now() - new Date(appState.startTimestamp).getTime()) / 1000) - appState.pausedTimeSeconds);
    appState.actualTimeSeconds = elapsed;
    const formattedTime = formatTime(appState.actualTimeSeconds);
    focusCurrentTimeDisplay.textContent = formattedTime;

    let pct = appState.actualTimeSeconds / appState.targetTimeSeconds * 100;
    appState.percentageCompleted = Math.floor(pct);
    
    if (pct < 100) {
        focusTimerRingContainer.style.setProperty('--pct', `${pct}%`);
        focusTimerRingContainer.style.background =
            `conic-gradient(var(--white) 0%, var(--white) var(--pct), var(--border) var(--pct), var(--border) 100%)`;
    } else {
        const overtimePct = pct - 100;
        focusTimerRingContainer.style.setProperty('--pct', `${overtimePct}%`);
        focusTimerRingContainer.style.background =
            `conic-gradient(var(--white) 0%, var(--white) var(--pct), var(--reward) var(--pct), var(--reward) 100%)`;
    }
    
    saveActiveSession(appState)
}

async function resetApp() {
    AppState.currentMission = '';
    AppState.targetTimeSeconds = 0;
    AppState.actualTimeSeconds = 0;
    AppState.completionStatus = 'partial';
    AppState.percentageCompleted = 0;
    AppState.isTimerRunning = false;
    AppState.startTimestamp = '';
    AppState.pauseStartTimestamp = '';
    AppState.pausedTimeSeconds = 0

    targetTimeDigits = 0;

    planMissionInput.value = '';
    planTargetTimeInput.value = '00:00';
    focusCurrentTimeDisplay.textContent = '00:00:00';
    focusTimerRingContainer.style.setProperty('--pct', '0%');

    clearActiveSession();
    reviewContinueBtn.classList.replace('normal-button', 'cta-button');
}

async function unauthFetch(options) {
    if (!options.path || !options.method) {
        throw new Error("Missing required options: path and method");
    }
    const response = await fetch(`${BACKEND_URL}/api/${options.path}`, {
        method: options.method,
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify(options.body),
        credentials: "include"
    });
    const statusCode = response.status;
    const result = await response.json();
    result.status = statusCode;
    return result;
}

async function register(username, email, password) {
    const result = await unauthFetch({
        path: "register",
        method: "POST",
        body: { username, email, password }
    });
    return result;
}

async function login(usernameOrEmail, password) {
    const result = await unauthFetch({
        path: "login",
        method: "POST",
        body: { usernameOrEmail, password }
    });
    return result;
}

async function refreshAccessToken() {
    const response = await fetch(`${BACKEND_URL}/api/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        credentials: "include"
    });
    if (response.status === 401 || response.status === 403) {
        return "";
    }
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || "Token refresh failed");
    }
    return result;
}

async function apiFetch(options) {
    if (!options.path || !options.method) {
        throw new Error("Missing required options: path and method");
    }
    const response = await fetch(`${BACKEND_URL}/api/${options.path}`, {
        method: options.method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(options.body)
    });
    if (response.status === 401) {
        const result = await refreshAccessToken();
        const retry = await fetch(`${BACKEND_URL}/api/${options.path}`, {
            method: options.method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${result.access_token}`
            },
            body: JSON.stringify(options.body)
        });
        if (retry.status === 401) {
            changeToLoginScreen(options.currentScreen);
            throw new Error("Unauthorized: Please log in.");
        }
        const retryResult = await retry.json();
        accessToken = result.access_token;
        planUserMenuUsername.textContent = result.username;
        dashboardUserMenuUsername.textContent = result.username;
        return retryResult;
    }
    const result = await response.json();
    return result;
}

async function logout() {
    const result = await apiFetch({
        path: "logout",
        method: "POST"
    });
    return result;
}

async function postSession(sessionData) {
    const result = await apiFetch({
        path: "save-session",
        method: "POST",
        body: sessionData,
        currentScreen: "review"
    });
    return result;
}

async function getSessions(currentScreen) {
    const result = await apiFetch({
        path: "get-sessions",
        method: "GET",
        currentScreen: currentScreen
    });
    return result.sessions;
}

async function deleteSession(sessionID) {
    const result = await apiFetch({
        path: `delete-session/${sessionID}`,
        method: "DELETE",
        currentScreen: "dashboard"
    });
    return result;
}


async function retryQueue() {
    while (QueueManager.queue.length > 0) {
        try {
            const sessionData = QueueManager.queue[0];
            await postSession(sessionData);
            QueueManager.removeFirst();
        } catch (error) {
            console.error("Retry failed:", error);
            break;
        }
    }
}

function saveActiveSession(appState) {
    const activeSession = {
        mission: appState.currentMission,
        targetTimeSeconds: appState.targetTimeSeconds,
        actualTimeSeconds: appState.actualTimeSeconds,
        startTimestamp: appState.startTimestamp,
        pauseStartTimestamp: appState.pauseStartTimestamp,
        pausedTimeSeconds: appState.pausedTimeSeconds
    }
    localStorage.setItem('executionOS_activeSession', JSON.stringify(activeSession));
}

function loadActiveSession(appState) {
    const stored = localStorage.getItem('executionOS_activeSession');
    if (stored) {
        const activeSession = JSON.parse(stored);
        appState.currentMission = activeSession.mission;
        appState.targetTimeSeconds = activeSession.targetTimeSeconds;
        appState.actualTimeSeconds = activeSession.actualTimeSeconds;
        appState.startTimestamp = activeSession.startTimestamp;
        appState.pauseStartTimestamp = activeSession.pauseStartTimestamp;
        appState.pausedTimeSeconds = activeSession.pausedTimeSeconds;

        if (!appState.pauseStartTimestamp) {
            const startTime = new Date(appState.startTimestamp).getTime();
            const lastActiveTime = startTime + (appState.actualTimeSeconds + appState.pausedTimeSeconds) * 1000;
            appState.pauseStartTimestamp = new Date(lastActiveTime).toISOString();
            saveActiveSession(appState)
        }

        return true;
    }
    return false;
}

function clearActiveSession() {
    localStorage.removeItem('executionOS_activeSession');
}



// ========== 4.1 DASHBOARD FUNCTIONS ==========

function renderDashboardData(sessions) {
    const [sessionsList, weeklyStats] = getDashboardData(sessions)
    
    if (sessionsList.length === 0) {
        dashboardWeeklyStatsContainer.style.display = "none";
        dashboardSessionsListContainer.style.display = "none";
        emptyDashboardCTAContainer.style.display = "flex";
        return;
    }
    dashboardWeeklyStatsContainer.style.display = "flex";
    dashboardSessionsListContainer.style.display = "flex";
    emptyDashboardCTAContainer.style.display = "none";

    dashboardSessionsListContainer.innerHTML = '';
    renderDashboardSessionsListTitle();
    displaySessionsOnContainer(sessionsList);
    dashboardAmountOfSessionsDisplay.textContent = `${weeklyStats[0]} sessions`
    dashboardAveragePercentageDisplay.textContent = `${weeklyStats[1]}%`
    dashboardTotalTimeDisplay.textContent = `${formatTimeTohm(weeklyStats[2])}`
}

function getDashboardData(sessions) {
    const [today, firstDayOfTheWeek] = getDashboardDataDateRange();
    const thisWeekSessions = getThisWeekSessions(sessions, today, firstDayOfTheWeek);
    const thisWeekStats = getThisWeekStats(thisWeekSessions);
    return [thisWeekSessions, thisWeekStats];
}

function getDashboardDataDateRange() {
    const today = new Date();
    const firstDayOfTheWeek = new Date(today);
    const daysSinceMonday = (today.getDay() + 6) % 7;
    firstDayOfTheWeek.setDate(today.getDate() - daysSinceMonday);
    firstDayOfTheWeek.setHours(0, 0, 0, 0);
    return [today, firstDayOfTheWeek];
}

function getThisWeekSessions(sessions, today, firstDayOfTheWeek) {
    const thisWeekSessions = [];
    for (const session of sessions) {
        const sessionDate = new Date(session.date + 'Z');
        if (sessionDate >= firstDayOfTheWeek && sessionDate <= today) {
            thisWeekSessions.push(session);
        }
    }
    thisWeekSessions.sort((a, b) => {
        const dateA = new Date(a.date + 'Z');
        const dateB = new Date(b.date + 'Z');
        return dateB - dateA;
    })

    return thisWeekSessions;
}

function getThisWeekStats(sessions) {
    if (sessions.length === 0) {
        return [0, 0, 0];
    }
    let thisWeekStats = [];
    let totalCombinedPercentages = 0;
    let totalTime = 0;
    for (const session of sessions) {
        totalCombinedPercentages += session.percentage_completed;
        totalTime += session.actual_time_seconds;
    }
    thisWeekStats.push(sessions.length);
    thisWeekStats.push(Math.round(totalCombinedPercentages / sessions.length));
    thisWeekStats.push(totalTime);
    return thisWeekStats;
}


function renderDashboardSessionsListTitle() {
    const dashboardSessionsListTitle = document.createElement("h2");
    dashboardSessionsListTitle.className = "dashboard-content-title";
    dashboardSessionsListTitle.textContent = "Sessions";
    dashboardSessionsListContainer.appendChild(dashboardSessionsListTitle);
}



function displaySessionsOnContainer(sessionsList) {
    lastDate = ''
    for (const session of sessionsList) {

        const dateObj = new Date(session.date + 'Z');
        const weekDay = NUMBER_TO_WEEKDAY[dateObj.getDay()];
        const month = DATE_TO_MONTHS[dateObj.getMonth() + 1];
        const date = dateObj.getDate();
        const uiDate = `${weekDay}, ${month} ${date}`;

        if (lastDate !== uiDate) {
            displayOnNewCard(session, uiDate, dateObj);
        }
        else {
            dashboardSessionCardId = `session-card-${dateObj.getMonth() + 1}-${dateObj.getDate()}`;
            displayOnExistingCard(session, dashboardSessionCardId);
        }
        lastDate = uiDate;
    }
}

function displayOnNewCard(session, uiDate, dateObj) {
    const dashboardSessionCard = document.createElement("div");
    const sessionCardDate = document.createElement("p");
    dashboardSessionCard.className = "dashboard-session-card";
    dashboardSessionCard.id = `session-card-${dateObj.getMonth() + 1}-${dateObj.getDate()}`;
    sessionCardDate.className = "dashboard-session-date";
    sessionCardDate.textContent = uiDate;
    dashboardSessionCard.appendChild(sessionCardDate);
    dashboardSessionsListContainer.appendChild(dashboardSessionCard);
    buildSessionContentBlock(session, dashboardSessionCard);
}

function displayOnExistingCard(session, dashboardSessionCardId) {
    const dashboardSessionCard = document.getElementById(dashboardSessionCardId);
    const sessionCardDivisionLine = document.createElement("span");
    sessionCardDivisionLine.className = "dashboard-session-division-line";
    dashboardSessionCard.appendChild(sessionCardDivisionLine);
    buildSessionContentBlock(session, dashboardSessionCard);
}

function buildSessionContentBlock(session, dashboardSessionCard) {
    const sessionCardMissionContainer = document.createElement("div");
    const sessionCardMissionIcon = document.createElement("span");
    const sessionCardMission = document.createElement("p");
    const dashboardSessionOpenMenuIcon = document.createElement("span");
    const dashboardSessionMenu = document.createElement("div");
    const dashboardSessionCloseMenuIcon = document.createElement("span");
    const dashboardDeleteSessionBtn = document.createElement("button");
    const timeAndPercentageContainer = document.createElement("div");
    const sessionCardTimeIcon = document.createElement("span");
    const sessionCardTargetTime = document.createElement("p");
    const sessionCardArrowIcon = document.createElement("span");
    const sessionCardActualTime = document.createElement("p");
    const sessionCardPercentage = document.createElement("p");
    const sessionCardCheckIcon = document.createElement("span");

    sessionCardMissionContainer.className = "dashboard-session-mission-container";
    sessionCardMissionIcon.className = "material-symbols-outlined dashboard-session-mission-icon";
    sessionCardMission.className = "dashboard-session-mission";
    dashboardSessionOpenMenuIcon.className = "material-symbols-outlined dashboard-session-open-menu-icon dashboard-session-toggle-menu-icon";
    dashboardSessionMenu.className = "dashboard-session-menu";
    dashboardSessionCloseMenuIcon.className = "material-symbols-outlined dashboard-session-close-menu-icon dashboard-session-toggle-menu-icon";
    dashboardDeleteSessionBtn.className = "dashboard-delete-session-btn";
    timeAndPercentageContainer.className = "dashboard-session-time-and-percentage-container";
    sessionCardTimeIcon.className = "material-symbols-outlined dashboard-session-time-icon";
    sessionCardTargetTime.className = "dashboard-session-target-time";
    sessionCardArrowIcon.className = "material-symbols-outlined dashboard-session-arrow-icon";
    sessionCardActualTime.className = "dashboard-session-actual-time";
    sessionCardPercentage.className = "dashboard-session-percentage";
    sessionCardCheckIcon.className = "material-symbols-outlined dashboard-session-check-icon";

    sessionCardMissionIcon.textContent = "assignment";
    sessionCardMission.textContent = session.mission;
    dashboardSessionOpenMenuIcon.textContent = "more_vert";
    dashboardSessionCloseMenuIcon.textContent = "more_vert";
    dashboardDeleteSessionBtn.textContent = "Delete Session";
    dashboardDeleteSessionBtn.dataset.sessionId = session.id;
    sessionCardTimeIcon.textContent = "timer";
    sessionCardTargetTime.textContent = formatTimeTohm(session.target_time_seconds);
    sessionCardArrowIcon.textContent = "arrow_right_alt";
    sessionCardActualTime.textContent = formatTimeTohm(session.actual_time_seconds);
    sessionCardPercentage.textContent = `${session.percentage_completed}%`;
    sessionCardCheckIcon.textContent = "check";
    
    dashboardSessionCard.appendChild(sessionCardMissionContainer);
    sessionCardMissionContainer.appendChild(sessionCardMissionIcon);
    sessionCardMissionContainer.appendChild(sessionCardMission);
    sessionCardMissionContainer.appendChild(dashboardSessionOpenMenuIcon);
    sessionCardMissionContainer.appendChild(dashboardSessionMenu);
    dashboardSessionMenu.appendChild(dashboardDeleteSessionBtn);
    dashboardSessionMenu.appendChild(dashboardSessionCloseMenuIcon);
    dashboardSessionCard.appendChild(timeAndPercentageContainer);
    timeAndPercentageContainer.appendChild(sessionCardTimeIcon);
    timeAndPercentageContainer.appendChild(sessionCardTargetTime);
    timeAndPercentageContainer.appendChild(sessionCardArrowIcon);
    timeAndPercentageContainer.appendChild(sessionCardActualTime);
    timeAndPercentageContainer.appendChild(sessionCardPercentage);
    timeAndPercentageContainer.appendChild(sessionCardCheckIcon);
}

function getPasswordError(password) {
    if (password.length < 12) {
        return 'At least 12 characters.';
    }
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#\$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]).+$/;
    if (!regex.test(password)) {
        return 'Must contain uppercase, lowercase, symbol, and number.';
    }
    return '';
}

function toggleUserMenu(screen) {
    const userMenu = screen === "plan" ? planUserMenu : dashboardUserMenu;
    
    if (isUserMenuOpened) {
        userMenu.style.display = 'none';
        isUserMenuOpened = false;
        return;
    }
    userMenu.style.display = 'flex';
    isUserMenuOpened = true;
}


function togglePasswordVisibility(passwordInput, visibilityButton) {
    const showIcon = visibilityButton.querySelector('.password-show-icon');
    const hideIcon = visibilityButton.querySelector('.password-hide-icon');
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        showIcon.style.display = 'none';
        hideIcon.style.display = 'block';
        visibilityButton.ariaLabel = "Hide password"
        return;
    }
    passwordInput.type = "password";
    showIcon.style.display = 'block';
    hideIcon.style.display = 'none';
    visibilityButton.ariaLabel = "Show password";
}

function hidePassword(passwordInput) {
    const visibilityButton = passwordInput.parentElement.querySelector('.password-visibility-btn');
    const showIcon = visibilityButton.querySelector('.password-show-icon');
    const hideIcon = visibilityButton.querySelector('.password-hide-icon');
    passwordInput.type = "password";
    showIcon.style.display = 'block';
    hideIcon.style.display = 'none';
    visibilityButton.ariaLabel = "Show password";
}


function showDashboardLoading() {
    dashboardWeeklyStatsContainer.style.display = "none";
    dashboardSessionsListContainer.style.display = "none";
    emptyDashboardCTAContainer.style.display = "none";

    dashboardLoading.style.display = "flex";
}

function hideDashboardLoading() {
    dashboardLoading.style.display = "none";
}

async function loadDashboard() {
    showDashboardLoading();

    try {
        const sessions = await getSessions();
        renderDashboardData(sessions);
    }
    catch (error) {
        console.error("Dashboard loading error:", error);
    }
    finally {
        hideDashboardLoading();
    }
}



// ========== 5. SCREEN CHANGE FUNCTIONS ==========

function showLoadingScreenError() {
    loadingIcon.style.display = 'none';
    loadingErrorMessage.style.display = 'flex';
    loadingRetryBtn.style.display = 'flex';
}

function showLoadingIcon() {
    loadingIcon.style.display = 'flex';
    loadingErrorMessage.style.display = 'none';
    loadingRetryBtn.style.display = 'none';
}

function changeToRegisterScreen(currentScreen) {
    if (currentScreen === "loading") {
        loadingIcon.style.display = 'none';
        loadingScreen.style.display = 'none';
        registerScreen.style.display = 'grid';
    }
    else if (currentScreen === "login") {
        loginScreen.style.display = 'none';
        registerScreen.style.display = 'grid';
    }
}

function changeToLoginScreen(currentScreen) {
    if (currentScreen === "register") {
        registerScreen.style.display = 'none';
        loginScreen.style.display = 'grid';
    }
    else if (currentScreen === "plan") {
        if (isUserMenuOpened) {
            toggleUserMenu("plan");
        }
        planScreen.style.display = 'none';
        loginScreen.style.display = 'grid';
    }
    else if (currentScreen === "focus") {
        focusScreen.style.display = 'none';
        loginScreen.style.display = 'grid';
    }
    else if (currentScreen === "review") {
        reviewScreen.style.display = 'none';
        loginScreen.style.display = 'grid';
    }
    else if (currentScreen === "dashboard") {
        if (isUserMenuOpened) {
            toggleUserMenu("dashboard");
        }
        dashboardScreen.style.display = 'none';
        loginScreen.style.display = 'grid';
    }
}

function changeToPlanScreen(currentScreen) {
    if (currentScreen === "loading") {
        loadingScreen.style.display = 'none';
        planScreen.style.display = 'flex';
    }
    else if (currentScreen === "register") {
        registerScreen.style.display = 'none';
        planScreen.style.display = 'flex';
    }
    else if (currentScreen === "login") {
        loginScreen.style.display = 'none';
        planScreen.style.display = 'flex';
    }
    else if (currentScreen === "dashboard") {
        if (isUserMenuOpened) {
            toggleUserMenu("dashboard");
        }
        dashboardScreen.style.display = 'none';
        planScreen.style.display = 'flex';
    }
}

function changeToFocusScreen(appState, currentScreen) {
    if (currentScreen === "review") {
        reviewScreen.style.display = 'none';
        focusScreen.style.display = 'flex';
        return;
    }
    focusMissionDisplay.textContent = appState.currentMission;
    focusTargetTimeDisplay.textContent = formatTime(appState.targetTimeSeconds);
    focusCurrentTimeDisplay.textContent = formatTime(appState.actualTimeSeconds);
    if (currentScreen === "loading") {
        loadingScreen.style.display = 'none';
        focusPauseBtn.textContent = 'Resume';
        focusScreen.style.display = 'flex';
    }
    else if (currentScreen === "plan") {
        if (isUserMenuOpened) {
            toggleUserMenu("plan");
        }
        planScreen.style.display = 'none';
        focusScreen.style.display = 'flex';
    }
}

function changeToReviewScreen(appState) {
    focusScreen.style.display = 'none';
    reviewScreen.style.display = 'grid';
    reviewMissionDisplay.textContent = appState.currentMission;
    reviewTargetTimeDisplay.textContent = formatTime(appState.targetTimeSeconds);
    reviewCompletionPercentageDisplay.textContent = `${appState.percentageCompleted}%`;
    reviewCompletionStatusDisplay.textContent = appState.completionStatus.charAt(0).toUpperCase() + appState.completionStatus.slice(1);
    reviewActualTimeDisplay.textContent = formatTime(appState.actualTimeSeconds);
    
    const pct = appState.percentageCompleted;
    if (pct < 100) {
        reviewProgressRingContainer.style.setProperty('--pct', `${pct}%`);
        reviewProgressRingContainer.style.background = `conic-gradient(var(--cta) 0%, var(--cta) var(--pct), var(--border) var(--pct), var(--border) 100%)`;
    } else {
        const overtimePct = pct - 100;
        reviewProgressRingContainer.style.setProperty('--pct', `${overtimePct}%`);
        reviewProgressRingContainer.style.background = `conic-gradient(var(--white) 0%, var(--white) var(--pct), var(--reward) var(--pct), var(--reward) 100%)`;

        reviewContinueBtn.classList.replace('cta-button', 'normal-button');
    }
}

function changeToDashboardScreen(currentScreen) {
    if (currentScreen === "plan") {
        if (isUserMenuOpened) {
            toggleUserMenu("plan");
        }
        planScreen.style.display = 'none';
        dashboardScreen.style.display = 'flex';
    }
    else if (currentScreen === "review") {
        reviewScreen.style.display = 'none';
        dashboardScreen.style.display = 'flex';
    }
}



// ========== 6. EVENT LISTENERS ==========

loadingRetryBtn.addEventListener('click', async () => {
    showLoadingIcon();
    await initiateApp();
});


passwordVisibilityButtons.forEach((passwordVisibilityButton) => {
    passwordVisibilityButton.addEventListener('click', () => {
        const passwordInput = passwordVisibilityButton.parentElement.querySelector('.input');
        togglePasswordVisibility(passwordInput, passwordVisibilityButton);
    });
});

registerSwitchToLoginBtn.addEventListener('click', () => {
    hidePassword(registerPasswordInput);
    changeToLoginScreen("register");
});

registerForm.addEventListener('submit', async () => {
    event.preventDefault();
    registerErrorMessage.textContent = '';
    registerPasswordErrorMessage.textContent = '';
    if (!registerEmailInput.value || !registerUsernameInput.value) {
        registerErrorMessage.textContent = 'Email and Username are needed to register';
        return;
    }
    if (!registerEmailInput.value.includes("@")) {
        registerErrorMessage.textContent = 'Email must contain @';
        return;
    }
    const passwordError = getPasswordError(registerPasswordInput.value);
    if (passwordError) {
        registerPasswordErrorMessage.textContent = passwordError;
        return;
    }
    let result;
    try {
        result = await register(registerUsernameInput.value, registerEmailInput.value, registerPasswordInput.value);
    } catch (error) {
        registerErrorMessage.textContent = 'Network/Server connection failed. Please try again';
        return;
    }
    if (result.status === 409) {
        registerErrorMessage.textContent = 'Username or Email already taken.';
        return;
    }
    else if (result.status === 400) {
        registerErrorMessage.textContent = 'Something went wrong. Please try again';
        return;
    }
    else if (result.success === true) {
        accessToken = result.access_token;
        planUserMenuUsername.textContent = result.username;
        dashboardUserMenuUsername.textContent = result.username;
        changeToPlanScreen("register");
    }
});

loginSwitchToRegisterBtn.addEventListener('click', () => {
    hidePassword(loginPasswordInput);
    changeToRegisterScreen("login");
});

loginForm.addEventListener('submit', async () => {
    event.preventDefault();
    loginErrorMessage.textContent = '';
    if (!loginUsernameOrEmailInput.value) {
        loginErrorMessage.textContent = 'Email or Username is needed to log in';
        return;
    }
    let result;
    try {
        result = await login(loginUsernameOrEmailInput.value, loginPasswordInput.value);
    } catch (error) {
        loginErrorMessage.textContent = 'Network/Server connection failed. Please try again';
        return;
    }
    if (result.status === 401) {
        loginErrorMessage.textContent = 'Email, username or password is incorrect';
        return;
    }
    else if (result.status === 400) {
        loginErrorMessage.textContent = 'Something went wrong. Please try again'
        return;
    }
    else if (result.success === true) {
        accessToken = result.access_token;
        planUserMenuUsername.textContent = result.username;
        dashboardUserMenuUsername.textContent = result.username;
        changeToPlanScreen("login");
    }
});

planUserIcon.addEventListener('click', () => {
    toggleUserMenu("plan");
});

planUserMenuLogoutBtn.addEventListener('click', async () => {
    if (!confirm("Are you sure you want to log out?")) {
        return;
    }
    try {
        await logout();
        accessToken = null;
        planUserMenuUsername.textContent = '';
        dashboardUserMenuUsername.textContent = '';
        changeToLoginScreen("plan");
    } catch (error) {
        alert("An unexpected network/server connection error occurred");
    }
});


planTargetTimeInput.addEventListener('keydown', (event) => {
    const allowedKeys = /^\d$/.test(event.key) || event.key === 'Backspace';
    if (!allowedKeys) return;

    event.preventDefault();

    let caretPosition = planTargetTimeInput.selectionStart;
    if (caretPosition === null || caretPosition === 0) return;
    if (caretPosition === 3) caretPosition = 2;

    const digitPosition = caretPosition - 1;
    const replacement = event.key === 'Backspace' ? '0' : event.key;

    const characters = planTargetTimeInput.value.split('');
    characters[digitPosition] = replacement;
    planTargetTimeInput.value = characters.join('');

    planTargetTimeInput.setSelectionRange(caretPosition, caretPosition);
});


planDashboardBtn.addEventListener('click', async () => {
    changeToDashboardScreen("plan");
    await loadDashboard();
});

planStartWorkBtn.addEventListener('click', () => {
    if (!planMissionInput.value) {
        alert('Please enter a mission');
        return;
    }
    if (planMissionInput.value.length > 50) {
        alert('Mission must be 50 characters or less');
        return;
    }
    if (!planTargetTimeInput.value || !/^\d{2}:\d{2}$/.test(planTargetTimeInput.value)) {
        alert('Please enter a target time in HH:MM format');
        return;
    }
    const [hours, minutes] = planTargetTimeInput.value.split(':').map(Number);
    if (minutes > 59) {
        alert('Minutes must be between 00 and 59');
        return;
    }
    if (hours === 0 && minutes === 0) {
        alert('Target time must be greater than 00:00');
        return;
    }
    const parsedTime = parseTimeFromHHMM(planTargetTimeInput.value);
    AppState.currentMission = planMissionInput.value;
    AppState.targetTimeSeconds = parsedTime;
    AppState.startTimestamp = new Date().toISOString()
    changeToFocusScreen(AppState, "plan");
    startTimer(AppState);
})

focusPauseBtn.addEventListener('click', () => {
    if (AppState.isTimerRunning) {
        clearInterval(timerInterval);
        AppState.isTimerRunning = false;
        focusPauseBtn.textContent = 'Resume';
        AppState.pauseStartTimestamp = new Date();
        saveActiveSession(AppState);
    }
    else {
        focusPauseBtn.textContent = 'Pause';
        const elapsed = (Date.now() - new Date(AppState.pauseStartTimestamp).getTime()) / 1000;
        AppState.pausedTimeSeconds += elapsed;
        AppState.pauseStartTimestamp = '';
        startTimer(AppState);
    }
});

focusStopBtn.addEventListener('click', () => {
    clearInterval(timerInterval);
    AppState.isTimerRunning = false;
    if (AppState.actualTimeSeconds >= AppState.targetTimeSeconds) {
        AppState.completionStatus = 'completed';
    }
    if (!AppState.pauseStartTimestamp) {
        AppState.pauseStartTimestamp = new Date();
    }
    changeToReviewScreen(AppState);
})

reviewContinueBtn.addEventListener('click', () => {
    changeToFocusScreen(AppState, "review");
    focusPauseBtn.textContent = 'Pause';
    const elapsed = (Date.now() - new Date(AppState.pauseStartTimestamp).getTime()) / 1000;
    AppState.pausedTimeSeconds += elapsed;
    AppState.pauseStartTimestamp = '';
    startTimer(AppState);
})

reviewFinishBtn.addEventListener('click', async () => {
    const sessionData = {
        date: new Date().toISOString(),
        mission: AppState.currentMission,
        targetTimeSeconds: AppState.targetTimeSeconds,
        actualTimeSeconds: AppState.actualTimeSeconds,
    };

    try {
        await postSession(sessionData);
        alert("Session saved successfully!\nReady for next session.");
    } catch (error) {
        console.error("Save error:", error);
        const addedToQueue = QueueManager.addToQueue(sessionData);
        if (!addedToQueue) {
            alert("Queue full: connection issues persist. Cannot save more sessions.");
        }
        else {
            alert("Added to offline queue, will sync when online.");
        }
    }
    
    resetApp();

    changeToDashboardScreen("review");
    await loadDashboard();
});

dashboardNewMissionBtn.addEventListener('click', () => {
    changeToPlanScreen("dashboard");
});

dashboardUserIcon.addEventListener('click', () => {
    toggleUserMenu("dashboard");
});

emptyDashboardStartMissionBtn.addEventListener('click', () => {
    changeToPlanScreen("dashboard");
});

dashboardUserMenuLogoutBtn.addEventListener('click', async () => {
    if (!confirm("Are you sure you want to log out?")) {
        return;
    }
    try {
        await logout();
        accessToken = null;
        planUserMenuUsername.textContent = '';
        dashboardUserMenuUsername.textContent = '';
        changeToLoginScreen("dashboard");
    } catch (error) {
        alert("An unexpected network/server connection error occurred");
    }
});

dashboardSessionsListContainer.addEventListener('click', (event) => {
    const dashboardSessionOpenMenuIcon = event.target.closest('.dashboard-session-open-menu-icon');
    if (!dashboardSessionOpenMenuIcon) return;
    const dashboardSessionOpenMenuIconParent = dashboardSessionOpenMenuIcon.parentElement;
    const dashboardSessionMenu = dashboardSessionOpenMenuIconParent.querySelector('.dashboard-session-menu');

    dashboardSessionOpenMenuIcon.style.pointerEvents = 'none';
    dashboardSessionMenu.style.display = 'flex';
});

dashboardSessionsListContainer.addEventListener('click', (event) => {
    const dashboardSessionCloseMenuIcon = event.target.closest('.dashboard-session-close-menu-icon');
    if (!dashboardSessionCloseMenuIcon) return;
    const dashboardSessionMenu = dashboardSessionCloseMenuIcon.parentElement;
    const dashboardSessionMenuParent = dashboardSessionMenu.parentElement;
    const dashboardSessionOpenMenuIcon = dashboardSessionMenuParent.querySelector('.dashboard-session-open-menu-icon');

    dashboardSessionOpenMenuIcon.style.pointerEvents = 'auto';
    dashboardSessionMenu.style.display = 'none';
})

dashboardSessionsListContainer.addEventListener('click', async (event) => {
    const deleteBtn = event.target.closest('.dashboard-delete-session-btn');
    if (!deleteBtn) return;

    if (!confirm("Delete this session?")) return;

    try {
        await deleteSession(deleteBtn.dataset.sessionId);
        const sessions = await getSessions();
        renderDashboardData(sessions);
    } catch (error) {
        alert("An unexpected network/server conection error occurred");
    }
});



document.addEventListener('click', (event) => {
    if (!isUserMenuOpened) return;

    const clickedInsidePlanMenu = planUserMenu.contains(event.target);
    const clickedPlanIcon = planUserIcon.contains(event.target);
    const clickedInsideDashboardMenu = dashboardUserMenu.contains(event.target);
    const clickedDashboardIcon = dashboardUserIcon.contains(event.target);

    if (clickedInsidePlanMenu || clickedPlanIcon || clickedInsideDashboardMenu || clickedDashboardIcon) return;

    planUserMenu.style.display = 'none';
    dashboardUserMenu.style.display = 'none';
    isUserMenuOpened = false;
});



// ========== 7. APP INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', async () => {
    await initiateApp();
});
