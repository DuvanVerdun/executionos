// ========== 1. CONSTANTS ==========

const BACKEND_URL = 'https://executionos.onrender.com';

const DATE_TO_MONTHS = {
    '01': 'Jan',
    '02': 'Feb',
    '03': 'Mar',
    '04': 'Apr',
    '05': 'May',
    '06': 'Jun',
    '07': 'Jul',
    '08': 'Aug',
    '09': 'Sep',
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
    completionStatus: 'uncompleted',
    percentageCompleted: 0,
    isTimerRunning: false,
    startTimestamp: '',
    pauseStartTimestamp: '',
    pausedTimeSeconds: 0
}

let timerInterval = null;


// ========== 3. DOM ELEMENT REFERENCES ==========

const loadingScreen = document.querySelector('.loading-screen');
const registerScreen = document.querySelector('.register-screen');
const loginScreen = document.querySelector('.login-screen');
const planScreen = document.querySelector('.plan-screen');
const focusScreen = document.querySelector('.focus-screen');
const reviewScreen = document.querySelector('.review-screen');
const dashboardScreen = document.querySelector('.dashboard-screen');

const loadingIcon = document.getElementById('loading-icon');
const loadingErrorMessage = document.getElementById('loading-error-message');
const retryBtn = document.getElementById('retry-btn');

const registerForm = document.getElementById('register-form');
const registerUsernameInput = document.getElementById('register-username-input');
const registerEmailInput = document.getElementById('register-email-input');
const registerPasswordInput = document.getElementById('register-password-input');
const registerPasswordErrorMessage = document.getElementById('register-password-error-message');
const registerSubmitBtn = document.getElementById('register-submit-btn');
const registerErrorMessage = document.getElementById('register-error-message');
const registerSwitchToLoginBtn = document.getElementById('switch-to-login-screen');

const loginForm = document.getElementById('login-form');
const loginUsernameOrEmailInput = document.getElementById('login-username-or-email-input');
const loginPasswordInput = document.getElementById('login-password-input');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginErrorMessage = document.getElementById('login-error-message');
const loginSwitchToRegisterBtn = document.getElementById('switch-to-register-screen');

const planUserMenuUsername = document.getElementById('plan-user-menu-username');
const planUserIcon = document.getElementById('plan-user-icon');
const planUserMenuLogoutBtn = document.getElementById('plan-user-menu-logout-btn');

const targetTimeInput = document.getElementById('time-input');
const missionInput = document.getElementById('mission-input');
const dashboardBtn = document.getElementById('dashboard-btn')
const startWorkBtn = document.getElementById('start-work-btn');

const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');

const continueBtn = document.getElementById('continue-btn');
const finishBtn = document.getElementById('finish-btn');

const newMissionBtn = document.getElementById('new-mission-btn');
const dashboardUserMenuUsername = document.getElementById('dashboard-user-menu-username');
const dashboardUserIcon = document.getElementById('dashboard-user-icon');
const dashboardUserMenuLogoutBtn = document.getElementById('dashboard-user-menu-logout-btn');



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
        await retryQueue;
    }
}


function parseTimeFromHHMMSS(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    return hours * 3600 + minutes * 60;
}

function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
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
    document.getElementById('timer').textContent = formattedTime;
    saveActiveSession(appState)
}

async function resetApp() {
    AppState.currentMission = '';
    AppState.targetTimeSeconds = 0;
    AppState.actualTimeSeconds = 0;
    AppState.completionStatus = 'uncompleted';
    AppState.percentageCompleted = 0;
    AppState.isTimerRunning = false;
    AppState.startTimestamp = '';
    AppState.pauseStartTimestamp = '';
    AppState.pausedTimeSeconds = 0

    missionInput.value = '';
    targetTimeInput.value = '';
    document.getElementById('timer').textContent = '00:00:00';

    clearActiveSession();
}

async function unauthFetch(options) {
    if (!options.path || !options.method) {
        throw new Error("Missing required options: path and method");
    }
    const response = await fetch(`${BACKEND_URL}/api/${options.path}`, {
        method: options.method,
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify(options.body)
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
    if (response.status === 401) {
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
        return true;
    }
    return false;
}

function clearActiveSession() {
    localStorage.removeItem('executionOS_activeSession');
}

function getDashboardDataDateRange() {
    const today = new Date();
    const todayWeekday = today.getUTCDay();
    
    const firstDayOfTheWeek = new Date();
    
    if (todayWeekday === 0) {
        firstDayOfTheWeek.setDate(today.getDate() - 6);
    }
    else {
        firstDayOfTheWeek.setDate(today.getDate() - todayWeekday);
    }
    return [today, firstDayOfTheWeek];
}

function getThisWeekSessions(sessions, today, firstDayOfTheWeek) {
    const thisWeekSessions = [];
    const weekDayIndex = 10;
    for (const session of sessions) {
        const sessionWithoutWeekDay = session.date.slice(0, weekDayIndex) + session.date.slice(weekDayIndex + 1);
        let sessionDate = new Date(sessionWithoutWeekDay);
        if (sessionDate >= firstDayOfTheWeek && sessionDate <= today) {
            thisWeekSessions.push(session);
        }
    }
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
        totalCombinedPercentages += session.percentageCompleted;
        totalTime += session.actualTimeSeconds;
    }
    thisWeekStats.push(sessions.length);
    thisWeekStats.push(Math.round(totalCombinedPercentages / sessions.length));
    thisWeekStats.push(totalTime);
    return thisWeekStats;
}

function getDashboardData(sessions) {
    const [today, firstDayOfTheWeek] = getDashboardDataDateRange(); 
    
    const thisWeekSessions = getThisWeekSessions(sessions, today, firstDayOfTheWeek);
    const thisWeekStats = getThisWeekStats(thisWeekSessions);
    return [thisWeekSessions, thisWeekStats];
}

function displayOnNewCard(session, sessionsListContainer, uiDate) {
        
    const dashboardSessionCard = document.createElement("div");
    const sessionCardDate = document.createElement("p");
    const sessionCardMissionContainer = document.createElement("div");
    const sessionCardMissionIcon = document.createElement("span");
    const sessionCardMission = document.createElement("p");
    const timeAndPercentageContainer = document.createElement("div");
    const sessionCardTimeIcon = document.createElement("span");
    const sessionCardTargetTime = document.createElement("p");
    const sessionCardArrowIcon = document.createElement("span");
    const sessionCardActualTime = document.createElement("p");
    const sessionCardPercentage = document.createElement("p");
    const sessionCardCheckIcon = document.createElement("span");

    dashboardSessionCard.className = "dashboard-session-card";
    dashboardSessionCard.id = `session-card-${session.date[10]}-${session.date.substring(5, 7)}-${session.date.substring(8, 10)}`;
    sessionCardDate.className = "dashboard-session-date";
    sessionCardMissionContainer.className = "dashboard-session-mission-container";
    sessionCardMissionIcon.className = "material-symbols-outlined dashboard-session-mission-icon";
    sessionCardMission.className = "dashboard-session-mission";
    timeAndPercentageContainer.className = "time-and-percentage-container";
    sessionCardTimeIcon.className = "material-symbols-outlined dashboard-session-time-icon";
    sessionCardTargetTime.className = "dashboard-session-target-time";
    sessionCardArrowIcon.className = "material-symbols-outlined dashboard-session-arrow-icon";
    sessionCardActualTime.className = "dashboard-session-actual-time";
    sessionCardPercentage.className = "dashboard-session-percentage";
    sessionCardCheckIcon.className = "material-symbols-outlined dashboard-session-check-icon";

    sessionCardDate.textContent = uiDate;
    sessionCardMissionIcon.textContent = "assignment";
    sessionCardMission.textContent = session.mission;
    sessionCardTimeIcon.textContent = "timer";
    sessionCardTargetTime.textContent = formatTimeTohm(session.targetTimeSeconds);
    sessionCardArrowIcon.textContent = "arrow_right_alt";
    sessionCardActualTime.textContent = formatTimeTohm(session.actualTimeSeconds);
    sessionCardPercentage.textContent = `${session.percentageCompleted}%`;
    sessionCardCheckIcon.textContent = "check";

    sessionsListContainer.appendChild(dashboardSessionCard);
        
    dashboardSessionCard.appendChild(sessionCardDate);
    dashboardSessionCard.appendChild(sessionCardMissionContainer);
    sessionCardMissionContainer.appendChild(sessionCardMissionIcon);
    sessionCardMissionContainer.appendChild(sessionCardMission);
    dashboardSessionCard.appendChild(timeAndPercentageContainer);
    timeAndPercentageContainer.appendChild(sessionCardTimeIcon);
    timeAndPercentageContainer.appendChild(sessionCardTargetTime);
    timeAndPercentageContainer.appendChild(sessionCardArrowIcon);
    timeAndPercentageContainer.appendChild(sessionCardActualTime);
    timeAndPercentageContainer.appendChild(sessionCardPercentage);
    timeAndPercentageContainer.appendChild(sessionCardCheckIcon);


}

function displayOnExistingCard(session, dashboardSessionCardId) {

    const dashboardSessionCard = document.getElementById(dashboardSessionCardId);

    const sessionCardDivisionLine = document.createElement("span");
    const sessionCardMissionContainer = document.createElement("div");
    const sessionCardMissionIcon = document.createElement("span");
    const sessionCardMission = document.createElement("p");
    const timeAndPercentageContainer = document.createElement("div");
    const sessionCardTimeIcon = document.createElement("span");
    const sessionCardTargetTime = document.createElement("p");
    const sessionCardArrowIcon = document.createElement("span");
    const sessionCardActualTime = document.createElement("p");
    const sessionCardPercentage = document.createElement("p");
    const sessionCardCheckIcon = document.createElement("span");

    sessionCardDivisionLine.className = "dashboard-session-division-line";
    sessionCardMissionContainer.className = "dashboard-session-mission-container";
    sessionCardMissionIcon.className = "material-symbols-outlined dashboard-session-mission-icon";
    sessionCardMission.className = "dashboard-session-mission";
    timeAndPercentageContainer.className = "time-and-percentage-container";
    sessionCardTimeIcon.className = "material-symbols-outlined dashboard-session-time-icon";
    sessionCardTargetTime.className = "dashboard-session-target-time";
    sessionCardArrowIcon.className = "material-symbols-outlined dashboard-session-arrow-icon";
    sessionCardActualTime.className = "dashboard-session-actual-time";
    sessionCardPercentage.className = "dashboard-session-percentage";
    sessionCardCheckIcon.className = "material-symbols-outlined dashboard-session-check-icon";

    sessionCardMissionIcon.textContent = "assignment";
    sessionCardMission.textContent = session.mission;
    sessionCardTimeIcon.textContent = "timer";
    sessionCardTargetTime.textContent = formatTimeTohm(session.targetTimeSeconds);
    sessionCardArrowIcon.textContent = "arrow_right_alt";
    sessionCardActualTime.textContent = formatTimeTohm(session.actualTimeSeconds);
    sessionCardPercentage.textContent = `${session.percentageCompleted}%`;
    sessionCardCheckIcon.textContent = "check";

    dashboardSessionCard.appendChild(sessionCardDivisionLine);
    dashboardSessionCard.appendChild(sessionCardMissionContainer);
    sessionCardMissionContainer.appendChild(sessionCardMissionIcon);
    sessionCardMissionContainer.appendChild(sessionCardMission);
    dashboardSessionCard.appendChild(timeAndPercentageContainer);
    timeAndPercentageContainer.appendChild(sessionCardTimeIcon);
    timeAndPercentageContainer.appendChild(sessionCardTargetTime);
    timeAndPercentageContainer.appendChild(sessionCardArrowIcon);
    timeAndPercentageContainer.appendChild(sessionCardActualTime);
    timeAndPercentageContainer.appendChild(sessionCardPercentage);
    timeAndPercentageContainer.appendChild(sessionCardCheckIcon);
}

function displaySessionsOnContainer(sessionsList, sessionsListContainer) {
    lastDate = ''
    for (const session of sessionsList) {
        
        const weekDay = NUMBER_TO_WEEKDAY[session.date[10]];
        const month = DATE_TO_MONTHS[session.date.substring(5, 7)];
        const DayNumberOfMonth = session.date.substring(8, 10);
        const uiDate = `${weekDay}, ${month} ${DayNumberOfMonth}`;

        if (lastDate !== uiDate) {
            displayOnNewCard(session, sessionsListContainer, uiDate);
        }
        else {
            dashboardSessionCardId = `session-card-${session.date[10]}-${session.date.substring(5, 7)}-${session.date.substring(8, 10)}`;
            displayOnExistingCard(session, dashboardSessionCardId);
        }
        
        lastDate = uiDate;
    }
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

function toggleUserMenu(screen) {  // relies on only one screen's menu ever being open at a time
    if (screen === "plan") {
        if (isUserMenuOpened) {
            planUserMenuUsername.style.display = 'none';
            planUserMenuLogoutBtn.style.display = 'none';
            isUserMenuOpened = false;
            return;
        }
    planUserMenuUsername.style.display = 'block';
    planUserMenuLogoutBtn.style.display = 'block';    
    isUserMenuOpened = true;
    }
    if (screen === "dashboard") {
        if (isUserMenuOpened) {
            dashboardUserMenuUsername.style.display = 'none';
            dashboardUserMenuLogoutBtn.style.display = 'none';
            isUserMenuOpened = false;
            return;
        }
    dashboardUserMenuUsername.style.display = 'block';
    dashboardUserMenuLogoutBtn.style.display = 'block';    
    isUserMenuOpened = true;
    }
}



// ========== 5. SCREEN CHANGE FUNCTIONS ==========

function showLoadingScreenError() {
    loadingIcon.style.display = 'none';
    loadingErrorMessage.style.display = 'flex';
    retryBtn.style.display = 'flex';
}

function showLoadingIcon() {
    loadingIcon.style.display = 'flex';
    loadingErrorMessage.style.display = 'none';
    retryBtn.style.display = 'none';
}

function changeToRegisterScreen(currentScreen) {
    if (currentScreen === "loading") {
        loadingIcon.style.display = 'none';
        loadingScreen.style.display = 'none';
        registerScreen.style.display = 'flex';
    }
    else if (currentScreen === "login") {
        loginScreen.style.display = 'none';
        registerScreen.style.display = 'flex';
    }
}

function changeToLoginScreen(currentScreen) {
    if (currentScreen === "register") {
        registerScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
    }
    else if (currentScreen === "plan") {
        if (isUserMenuOpened) {
            toggleUserMenu("plan");
        }
        planScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
    }
    else if (currentScreen === "focus") {
        focusScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
    }
    else if (currentScreen === "review") {
        reviewScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
    }
    else if (currentScreen === "dashboard") {
        if (isUserMenuOpened) {
            toggleUserMenu("dashboard");
        }
        dashboardScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
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
    document.getElementById('mission-display').textContent = `Mission: ${appState.currentMission}`;
    document.getElementById('target-time-display').textContent = `Target Time: ${formatTime(appState.targetTimeSeconds)}`;
    document.getElementById('timer').textContent = formatTime(appState.actualTimeSeconds);
    if (currentScreen === "loading") {
        loadingScreen.style.display = 'none';
        pauseBtn.textContent = 'Resume';
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
    reviewScreen.style.display = 'flex';
    document.getElementById('target-time-review').textContent = `Target Time: ${formatTime(appState.targetTimeSeconds)}`;
    document.getElementById('actual-time-review').textContent = `Actual Time: ${formatTime(appState.actualTimeSeconds)}`;
    document.getElementById('completion-percentage-review').textContent = `${appState.percentageCompleted}%`;
    document.getElementById('completion-status-review').textContent = appState.completionStatus;
}

function changeToDashboardScreen(sessions, currentScreen) {
    const [sessionsList, weeklyStats] = getDashboardData(sessions)
    const currentAmountOfSessions = document.getElementById('amount-of-sessions').textContent.slice(0, -9);
    const isSessionsListUpdated = Number(currentAmountOfSessions) === Number(weeklyStats[0]);
    const sessionsListContainer = document.querySelector(".sessions-list-container");
    if (sessionsList && (!isSessionsListUpdated)) {
        displaySessionsOnContainer(sessionsList, sessionsListContainer);
    }

    document.getElementById('amount-of-sessions').textContent = `${weeklyStats[0]} sessions`
    document.getElementById('average-percentage').textContent = `${weeklyStats[1]}%`
    document.getElementById('total-time').textContent = `${formatTimeTohm(weeklyStats[2])}`

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

retryBtn.addEventListener('click', async () => {
    showLoadingIcon();
    await initiateApp();
});

registerSwitchToLoginBtn.addEventListener('click', () => {
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
        changeToPlanScreen("register");
    }
});

loginSwitchToRegisterBtn.addEventListener('click', () => {
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

dashboardBtn.addEventListener('click', async () => {
    const sessions = await getSessions();
    changeToDashboardScreen(sessions, "plan");
});

startWorkBtn.addEventListener('click', () => {
    if (!missionInput.value) {
        alert('Please enter a mission');
        return;
    }
    if (!targetTimeInput.value || !/^\d{2}:\d{2}$/.test(targetTimeInput.value)) {
        alert('Please enter a target time in HH:MM format');
        return;
    }
    const parsedTime = parseTimeFromHHMMSS(targetTimeInput.value);
    AppState.currentMission = missionInput.value;
    AppState.targetTimeSeconds = parsedTime;
    AppState.startTimestamp = new Date().toISOString()
    changeToFocusScreen(AppState, "plan");
    startTimer(AppState);
})

pauseBtn.addEventListener('click', () => {
    if (AppState.isTimerRunning) {
        clearInterval(timerInterval);
        AppState.isTimerRunning = false;
        pauseBtn.textContent = 'Resume';
        AppState.pauseStartTimestamp = new Date();
    }
    else {
        pauseBtn.textContent = 'Pause';
        const elapsed = (Date.now() - new Date(AppState.pauseStartTimestamp).getTime()) / 1000;
        AppState.pausedTimeSeconds += elapsed;
        startTimer(AppState);
    }
})

stopBtn.addEventListener('click', () => {
    clearInterval(timerInterval);
    AppState.isTimerRunning = false;
    AppState.percentageCompleted = Math.floor(AppState.actualTimeSeconds / AppState.targetTimeSeconds * 100);
    if (AppState.actualTimeSeconds >= AppState.targetTimeSeconds) {
        AppState.completionStatus = 'completed';
    }
    if (!AppState.pauseStartTimestamp) {
        AppState.pauseStartTimestamp = new Date();
    }
    changeToReviewScreen(AppState);
})

continueBtn.addEventListener('click', () => {
    changeToFocusScreen(AppState, "review");
    pauseBtn.textContent = 'Pause';
    const elapsed = (Date.now() - new Date(AppState.pauseStartTimestamp).getTime()) / 1000;
    AppState.pausedTimeSeconds += elapsed;
    startTimer(AppState);
})

finishBtn.addEventListener('click', async () => {
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

    const sessions = await getSessions();
    changeToDashboardScreen(sessions, "review");
});

newMissionBtn.addEventListener('click', () => {
    changeToPlanScreen("dashboard");
});

dashboardUserIcon.addEventListener('click', () => {
    toggleUserMenu("dashboard");
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


// ========== 7. APP INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', async () => {
    await initiateApp();
});
