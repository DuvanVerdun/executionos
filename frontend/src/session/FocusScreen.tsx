import { formatDuration } from '../lib/durations';
import { useStore } from '../lib/store';
import { roomSessionStore } from '../rooms/room-session-state';
import { ProgressRing } from '../shared/ProgressRing';
import { Screen } from '../shared/Screen';
import { handlePauseResume, handleStopWork } from './focus';
import { sessionStore } from './state';
import { focusStore } from './ui-state';

/** Draw the Focus screen. A room session shows its own session and its room name. */
export function FocusScreen() {
    const personal = useStore(sessionStore).active;
    const room = useStore(roomSessionStore);
    const { pauseLabel } = useStore(focusStore);
    const session = room.active ? room.display : personal;
    const exactPercentage = session.actualTimeSeconds / session.targetTimeSeconds * 100;

    return (
        <Screen name="focus" className="focus-screen">
            <ProgressRing
                id="focus-timer-ring-container"
                percentage={exactPercentage}
                beforeTargetColor="var(--color-white)"
                afterTargetColor="var(--color-reward)"
            >
                <div className="focus-timer-ring-mask"></div>

                <p id="focus-room-name-display" className="focus-room-name" hidden={!room.active}>{room.roomName}</p>

                <div className="focus-display-container">
                    <p id="focus-mission-display">{session.currentMission}</p>
                    <p id="focus-target-time-display">{formatDuration(session.targetTimeSeconds)}</p>
                </div>

                <p id="focus-current-time-display">{formatDuration(session.actualTimeSeconds)}</p>

                <div className="focus-button-container">
                    <button id="focus-pause-btn" className="normal-button" disabled={room.isBusy} onClick={handlePauseResume}>
                        {pauseLabel}
                    </button>
                    <button id="focus-stop-btn" className="normal-button" disabled={room.isBusy} onClick={handleStopWork}>
                        Stop
                    </button>
                </div>
            </ProgressRing>
        </Screen>
    );
}
