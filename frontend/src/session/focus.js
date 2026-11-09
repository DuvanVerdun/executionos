// Focus screen: pause, resume and stop.

import { handleRoomPauseResume, handleRoomStop } from '../rooms/room-session.js';
import { roomSessionState } from '../rooms/state.js';
import { navigateTo } from '../shared/navigation.js';
import { focusDom } from './dom.js';
import { activeSessionState } from './state.js';
import { saveActiveSession } from './storage.js';
import { pauseSession, resumeSession, stopSession } from './timer.js';

/** Toggle the active session between paused and running states. */
function handlePauseResume() {
    if (roomSessionState.active) {
        void handleRoomPauseResume();
        return;
    }
    if (activeSessionState.isTimerRunning) {
        pauseSession(activeSessionState);
        focusDom.pauseButton.textContent = 'Resume';
        saveActiveSession(activeSessionState);
    } else {
        focusDom.pauseButton.textContent = 'Pause';
        resumeSession(activeSessionState);
    }
}

/** Stop the active session and open Review. */
function handleStopWork() {
    if (roomSessionState.active) {
        void handleRoomStop();
        return;
    }
    stopSession(activeSessionState);
    navigateTo('review', 'focus');
}

/** Connect the Focus screen controls. */
export function initFocus() {
    focusDom.pauseButton.addEventListener('click', handlePauseResume);
    focusDom.stopButton.addEventListener('click', handleStopWork);
}
