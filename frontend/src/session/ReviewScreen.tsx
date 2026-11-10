import { useT } from '../i18n/i18n';
import { formatAverageSessionTime, formatDurationHoursMinutes, formatDurationHoursMinutesSeconds } from '../lib/durations';
import { useStore } from '../lib/store';
import { roomSessionStore } from '../rooms/room-session-state';
import { ProgressRing } from '../shared/ProgressRing';
import { Screen } from '../shared/Screen';
import { handleContinueWork, handleFinishWork } from './review';
import { sessionStore } from './state';
import { reviewStore, type FinishLabel } from './ui-state';

/** Draw the Review screen. */
export function ReviewScreen() {
    const t = useT();
    const { active: personal, isFinishing, pendingSubmission } = useStore(sessionStore);
    const room = useStore(roomSessionStore);
    const { saveMessage, finishLabel, roomSummary } = useStore(reviewStore);
    const session = room.active ? room.display : personal;
    const status = session.completionStatus === 'completed' ? t('review.completed') : t('review.partial');
    const finishTexts: Record<FinishLabel, string> = {
        'Finish': t('review.finish'),
        'Saving…': t('review.saving'),
        'Retrying…': t('review.retrying'),
        'Try again': t('review.tryAgain')
    };

    return (
        <Screen name="review" className="wordmark-centered-layout review-screen" busy={isFinishing}>
            <h1 className="wordmark" hidden={room.active}>ExecutionOS</h1>

            <h1 id="review-room-name" className="wordmark" hidden={!room.active}>{room.roomName}</h1>

            <div className="review-body">

                <div id="review-room-summary" className="review-room-summary" hidden={!room.active}>
                    <div className="dashboard-summary-grid">
                        <div className="dashboard-summary-card">
                            <p id="review-room-total-time" className="dashboard-summary-value">
                                {roomSummary ? formatDurationHoursMinutes(roomSummary.total_time_seconds) : '—'}
                            </p>
                            <p className="dashboard-summary-label">{t('review.focused')}</p>
                        </div>
                        <div className="dashboard-summary-card">
                            <p id="review-room-session-count" className="dashboard-summary-value">
                                {roomSummary ? String(roomSummary.total_sessions) : '—'}
                            </p>
                            <p className="dashboard-summary-label">{t('review.sessions')}</p>
                        </div>
                        <div className="dashboard-summary-card">
                            <p id="review-room-people-count" className="dashboard-summary-value">
                                {roomSummary ? String(roomSummary.members_count) : '—'}
                            </p>
                            <p className="dashboard-summary-label">{t('review.people')}</p>
                        </div>
                        <div className="dashboard-summary-card">
                            <p id="review-room-average-time" className="dashboard-summary-value">
                                {roomSummary ? formatAverageSessionTime(roomSummary.average_session_time_seconds) : '—'}
                            </p>
                            <p className="dashboard-summary-label">{t('review.averageSessionTime')}</p>
                        </div>
                    </div>
                </div>

                <div className="review-container">
                    <div className="review-display-container">
                        <p id="review-mission-display">{session.currentMission}</p>
                        <p id="review-target-time-display">{t('review.target', { time: formatDurationHoursMinutesSeconds(session.targetTimeSeconds) })}</p>
                    </div>
                    <div className="review-summary">
                        <div className="review-progress-container">
                            <p id="review-completion-status-display">{status}</p>
                            <ProgressRing
                                id="review-progress-ring-container"
                                percentage={session.percentageCompleted}
                                beforeTargetColor="var(--color-cta)"
                                afterTargetColor="var(--color-reward)"
                            >
                                <div className="review-progress-ring-mask"></div>
                                <p id="review-completion-percentage-display">{`${session.percentageCompleted}%`}</p>
                            </ProgressRing>
                        </div>
                        <div className="review-time-container">
                            <p className="review-time-label">{t('review.focused')}</p>
                            <p id="review-actual-time-display">{formatDurationHoursMinutesSeconds(session.actualTimeSeconds)}</p>
                        </div>
                    </div>

                    <div className="review-button-container">
                        <button
                            id="review-continue-btn"
                            className={session.percentageCompleted >= 100 ? 'normal-button' : 'cta-button'}
                            disabled={isFinishing || pendingSubmission !== null || room.isBusy}
                            onClick={handleContinueWork}
                        >
                            {t('review.continue')}
                        </button>
                        <button
                            id="review-finish-btn"
                            className="reward-button"
                            disabled={isFinishing || room.isBusy}
                            onClick={() => { void handleFinishWork(); }}
                        >
                            {finishTexts[finishLabel]}
                        </button>
                    </div>
                    <p id="review-save-message" className="session-save-message" role="status" aria-live="polite">{saveMessage}</p>
                </div>

            </div>
        </Screen>
    );
}
