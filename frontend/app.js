// ========== 1. CONSTANTS ==========

const BACKEND_URL = 'https://executionos-production.up.railway.app';

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
    fromPlanScreen: true,
    startTimestamp: '',
    pauseStartTimestamp: '',
    pausedTimeSeconds: 0
}

let timerInterval = null;


// ========== 3. DOM ELEMENT REFERENCES ==========

const targetTimeInput = document.getElementById('time-input');
const missionInput = document.getElementById('mission-input');
const dashboardBtn = document.getElementById('dashboard-btn')
const startWorkBtn = document.getElementById('start-work-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const continueBtn = document.getElementById('continue-btn');
const finishBtn = document.getElementById('finish-btn');
const newMissionBtn = document.getElementById('new-mission-btn');


// ========== 4. UTILITY FUNCTIONS ==========

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
    AppState.fromPlanScreen = true;
    AppState.startTimestamp = '';
    AppState.pauseStartTimestamp = '';
    AppState.pausedTimeSeconds = 0

    missionInput.value = '';
    targetTimeInput.value = '';
    document.getElementById('timer').textContent = '00:00:00';

    clearActiveSession();

    const sessions = await getSessions();
    await changeToDashboardScreen(sessions, fromPlan=false)
}

async function postSession(sessionData) {
    const response = await fetch(`${BACKEND_URL}/api/save-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData)
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || "Save failed");
    }
    return result;
}

async function getSessions() {
    const response = await fetch(`${BACKEND_URL}/api/get-sessions`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
    });

    const result = await response.json(); 

    if (!result.success) {
        throw new Error(result.error || "Fetch failed");
    }
    console.log("Fetched sessions:", result.sessions);
    return result.sessions;
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



// ========== 5. SCREEN CHANGE FUNCTIONS ==========

function changeToFocusScreen(appState) {
    const focusScreen = document.querySelector('.focus-screen');
    if (AppState.fromPlanScreen) {
        const planScreen = document.querySelector('.plan-screen');
        planScreen.style.display = 'none';
        focusScreen.style.display = 'flex';
        document.getElementById('mission-display').textContent = `Mission: ${appState.currentMission}`;
        document.getElementById('target-time-display').textContent = `Target Time: ${formatTime(appState.targetTimeSeconds)}`;
        document.getElementById('timer').textContent = formatTime(appState.actualTimeSeconds);
    }
    else {
        const reviewScreen = document.querySelector('.review-screen');
        reviewScreen.style.display = 'none';
        focusScreen.style.display = 'flex';
    }
}

function changeToReviewScreen(appState) {
    const focusScreen = document.querySelector('.focus-screen');
    const reviewScreen = document.querySelector('.review-screen');
    focusScreen.style.display = 'none';
    reviewScreen.style.display = 'flex';
    document.getElementById('target-time-review').textContent = `Target Time: ${formatTime(appState.targetTimeSeconds)}`;
    document.getElementById('actual-time-review').textContent = `Actual Time: ${formatTime(appState.actualTimeSeconds)}`;
    document.getElementById('completion-percentage-review').textContent = `${appState.percentageCompleted}%`;
    document.getElementById('completion-status-review').textContent = appState.completionStatus;
}

function changeToDashboardScreen(sessions, fromPlan) {
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

    const lastScreen = fromPlan ? document.querySelector('.plan-screen') : document.querySelector('.review-screen');
    const dashboardScreen = document.querySelector('.dashboard-screen');
    lastScreen.style.display = 'none';
    dashboardScreen.style.display = 'flex';
}

function changeToPlanScreen() {
    const planScreen = document.querySelector('.plan-screen');
    const dashboardScreen = document.querySelector('.dashboard-screen');
    dashboardScreen.style.display = 'none';
    planScreen.style.display = 'flex';
}



// ========== 6. EVENT LISTENERS ==========

dashboardBtn.addEventListener('click', async () => {
    const sessions = await getSessions();
    await changeToDashboardScreen(sessions, fromPlan=true);
})

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
    changeToFocusScreen(AppState);
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
    AppState.fromPlanScreen = false;
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
    changeToFocusScreen(AppState);
    pauseBtn.textContent = 'Pause';
    const elapsed = (Date.now() - new Date(AppState.pauseStartTimestamp).getTime()) / 1000;
    AppState.pausedTimeSeconds += elapsed;
    startTimer(AppState);
})

finishBtn.addEventListener('click', async () => {
    
    const date = new Date();
    const weekday = date.getUTCDay();
    const isoString = date.toISOString();
    const dateWithWeekDay = isoString.replace('T', weekday + 'T');
    
    const sessionData = {
        date: dateWithWeekDay,
        mission: AppState.currentMission,
        targetTimeSeconds: AppState.targetTimeSeconds,
        actualTimeSeconds: AppState.actualTimeSeconds,
        completionStatus: AppState.completionStatus,
        percentageCompleted: AppState.percentageCompleted
    };

    try {
        await postSession(sessionData);
        alert("✅ Session saved successfully!\nReady for next session.");
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
});

newMissionBtn.addEventListener('click', () => {
    changeToPlanScreen()
})


// ========== 7. APP INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', async () => {
    QueueManager.loadQueue()
    if (QueueManager.queue.length > 0) {
        alert("Syncing offline work...");
        await retryQueue();
    }
    const loadedActiveSession = loadActiveSession(AppState)
    if (loadedActiveSession) {
        alert("Returning to uncompleted session...");
        changeToFocusScreen(AppState)
        pauseBtn.textContent = 'Resume';
    }
});