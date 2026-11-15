import { useT } from '../i18n/i18n';
import { formatDurationHoursMinutesSeconds } from '../lib/durations';
import { useStore } from '../lib/store';
import { roomSessionStore } from '../rooms/room-session-state';
import { RoomRanking } from '../rooms/RoomRanking';
import { RoomSummaryCards } from '../rooms/RoomSummaryCards';
import { ProgressRing } from '../shared/ProgressRing';
import { Screen } from '../shared/Screen';
import { handleContinueWork, handleFinishWork } from './review';
import { sessionStore } from './state';
import { reviewStore, type FinishLabel } from './ui-state';

/** Draw the card that reviews the session: its mission, the time worked, and the Continue and Finish buttons. */
function ReviewCard({ className }: { className: string }) {
    const t = useT();
    const { active: personal, isFinishing, pendingSubmission } = useStore(sessionStore);
    const room = useStore(roomSessionStore);
    const { saveMessage, finishLabel } = useStore(reviewStore);
    const session = room.active ? room.display : personal;
    const status = session.completionStatus === 'completed' ? t('review.completed') : t('review.partial');
    const finishTexts: Record<FinishLabel, string> = {
        'Finish': t('review.finish'),
        'Saving…': t('review.saving'),
        'Retrying…': t('review.retrying'),
        'Try again': t('review.tryAgain')
    };

    return (
        <div className={className}>
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
                    className={session.percentageCompleted >= 100 ? 'reward-button is-glowing' : 'reward-button'}
                    disabled={isFinishing || room.isBusy}
                    onClick={() => { void handleFinishWork(); }}
                >
                    {finishTexts[finishLabel]}
                </button>
            </div>
            <p id="review-save-message" className="session-save-message" role="status" aria-live="polite">{saveMessage}</p>
        </div>
    );
}

/** Draw Review for a personal session: the wordmark and the review card, centered. */
function PersonalReview() {
    const { isFinishing } = useStore(sessionStore);

    return (
        <Screen name="review" className="wordmark-centered-layout review-screen" busy={isFinishing}>
            <h1 className="wordmark">ExecutionOS</h1>
            <div className="review-body">
                <ReviewCard className="review-container" />
            </div>
        </Screen>
    );
}

/** Draw Review for a room session. It has the layout of the Room screen, with the review card where the plan card is. */
function RoomReview() {
    const { isFinishing } = useStore(sessionStore);
    const { roomName } = useStore(roomSessionStore);
    const { roomSummary, roomRanking } = useStore(reviewStore);

    return (
        <Screen name="review" display="flex" className="room-screen room-review-screen" busy={isFinishing}>
            <div className="room-container">
                <div className="room-topbar">
                    <h1 className="room-title is-centered">{roomName}</h1>
                </div>
                <RoomSummaryCards summary={roomSummary} />
                <div className="room-main-row room-review-row">
                    <ReviewCard className="plan-input-section room-mission-card room-review-card" />
                    <RoomRanking ranking={roomRanking?.entries ?? []} receivedAt={roomRanking?.receivedAt} />
                </div>
            </div>
        </Screen>
    );
}

/** Draw the Review screen. */
export function ReviewScreen() {
    const { active: isRoomSession } = useStore(roomSessionStore);
    return isRoomSession ? <RoomReview /> : <PersonalReview />;
}
