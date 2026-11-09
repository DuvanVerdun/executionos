import { handleRoomPauseResume, handleRoomStop } from '../rooms/room-session';
import { roomSessionStore } from '../rooms/room-session-state';
import { navigateTo } from '../shared/navigation';
import { sessionStore } from './state';
import { saveActiveSession } from './storage';
import { focusStore } from './ui-state';
import { pauseSession, resumeSession, stopSession } from './timer';

/** Toggle the active session between paused and running states. */
export function handlePauseResume(): void {
    if (roomSessionStore.get().active) {
        void handleRoomPauseResume();
        return;
    }
    if (sessionStore.get().active.isTimerRunning) {
        pauseSession();
        focusStore.set({ pauseLabel: 'Resume' });
        saveActiveSession(sessionStore.get().active);
    } else {
        focusStore.set({ pauseLabel: 'Pause' });
        resumeSession();
    }
}

/** Stop the active session and open Review. */
export function handleStopWork(): void {
    if (roomSessionStore.get().active) {
        void handleRoomStop();
        return;
    }
    stopSession();
    navigateTo('review', 'focus');
}
