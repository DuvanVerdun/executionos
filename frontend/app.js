// ========== 1. CONSTANTS ==========

const BACKEND_URL = 'https://executionos-production.up.railway.app';


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
    startTimestamp: ''
}

let timerInterval = null;


// ========== 3. DOM ELEMENT REFERENCES ==========

const targetTimeInput = document.getElementById('time-input');
const missionInput = document.getElementById('mission-input');
const startWorkBtn = document.getElementById('start-work-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const continueBtn = document.getElementById('continue-btn');
const finishBtn = document.getElementById('finish-btn');


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

function startTimer(appState) {
    appState.isTimerRunning = true;
    timerInterval = setInterval(updateTimer.bind(null, appState), 1000);
}

function updateTimer(appState) {
    if (!appState.isTimerRunning) return;
    appState.actualTimeSeconds += 1;
    const formattedTime = formatTime(appState.actualTimeSeconds);
    document.getElementById('timer').textContent = formattedTime;
    saveActiveSession(appState)
}

function resetApp() {
    AppState.currentMission = '';
    AppState.targetTimeSeconds = 0;
    AppState.actualTimeSeconds = 0;
    AppState.completionStatus = 'uncompleted';
    AppState.percentageCompleted = 0;
    AppState.isTimerRunning = false;
    AppState.fromPlanScreen = true;
    AppState.startTimestamp = '';

    missionInput.value = '';
    targetTimeInput.value = '';
    document.getElementById('timer').textContent = '00:00:00';

    clearActiveSession();

    const planScreen = document.querySelector('.plan-screen');
    const reviewScreen = document.querySelector('.review-screen')
    reviewScreen.style.display = 'none';
    planScreen.style.display = 'flex';
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
        startTimestamp: appState.startTimestamp
    }
    localStorage.setItem('executionOS_activeSession', JSON.stringify(activeSession));
}

function loadActiveSession(appState) {
    const stored = localStorage.getItem('executionOS_activeSession');
    if (stored) {
        const activeSession = JSON.parse(stored)
        appState.currentMission = activeSession.mission;
        appState.targetTimeSeconds = activeSession.targetTimeSeconds;
        appState.actualTimeSeconds = activeSession.actualTimeSeconds;
        appState.startTimestamp = activeSession.startTimestamp;
        return true;
    }
    return false;
}

function clearActiveSession() {
    localStorage.removeItem('executionOS_activeSession');
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


// ========== 6. EVENT LISTENERS ==========

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
    }
    else {
        startTimer(AppState);
        AppState.isTimerRunning = true;
        pauseBtn.textContent = 'Pause';
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
    changeToReviewScreen(AppState);
})

continueBtn.addEventListener('click', () => {
    changeToFocusScreen(AppState);
    startTimer(AppState);
    pauseBtn.textContent = 'Pause';
})

finishBtn.addEventListener('click', async () => {
    const sessionData = {
        mission: AppState.currentMission,
        target_time: formatTime(AppState.targetTimeSeconds),
        actual_time: formatTime(AppState.actualTimeSeconds),
        completion_percent: AppState.percentageCompleted,
        completion_status: AppState.completionStatus,
        timestamp: new Date().toISOString()
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