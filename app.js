const AppState = {
    currentMission: '',
    targetTimeSeconds: 0,
    actualTimeSeconds: 0,
    isTimerRunning: false
}

let timerInterval = null;

const startWorkBtn = document.getElementById('start-work-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');

startWorkBtn.addEventListener('click', () => {
    parsedTime = parseTimeFromHHMMSS(document.getElementById('time-input').value);
    AppState.currentMission = document.getElementById('mission-input').value;
    AppState.targetTimeSeconds = parsedTime;
    changeToFocusScreen(AppState);
    startTimer(AppState);
})

function changeToFocusScreen(appState) {
    const planScreen = document.querySelector('.plan-screen');
    const focusScreen = document.querySelector('.focus-screen');
    planScreen.style.display = 'none';
    focusScreen.style.display = 'flex';
    document.getElementById('mission-display').textContent = `Mission: ${appState.currentMission}`;
    document.getElementById('target-time-display').textContent = `Target Time: ${document.getElementById('time-input').value}`;
}

function parseTimeFromHHMMSS(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    return hours * 3600 + minutes * 60;
}

function startTimer(appState) {
    appState.isTimerRunning = true;
    timerInterval = setInterval(updateTimer.bind(null, appState), 1000);
}

function updateTimer(appState) {
    if (!appState.isTimerRunning) return;
    appState.actualTimeSeconds += 1;
    const hours = Math.floor(appState.actualTimeSeconds / 3600);
    const minutes = Math.floor((appState.actualTimeSeconds % 3600) / 60);
    const seconds = appState.actualTimeSeconds % 60;
    const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    document.getElementById('timer').textContent = formattedTime;
}

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
})