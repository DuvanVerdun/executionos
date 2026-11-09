// Focus screen: pause, resume and stop.

import { handleRoomPauseResume, handleRoomStop } from '../rooms/room-session';
import { roomSessionState } from '../rooms/state';
import { navigateTo } from '../shared/navigation';
import { focusDom } from './dom';
import { activeSessionState } from './state';
import { saveActiveSession } from './storage';
import { pauseSession, resumeSession, stopSession } from './timer';

/** Toggle the active session between paused and running states. */
function handlePauseResume(): void {
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
function handleStopWork(): void {
    if (roomSessionState.active) {
        void handleRoomStop();
        return;
    }
    stopSession(activeSessionState);
    navigateTo('review', 'focus');
}

/** Connect the Focus screen controls. */
export function initFocus(): void {
    focusDom.pauseButton.addEventListener('click', handlePauseResume);
    focusDom.stopButton.addEventListener('click', handleStopWork);
}
