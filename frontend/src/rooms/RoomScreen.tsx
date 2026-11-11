import { useRef, useState } from 'react';
import { BEAT_AVERAGE_INCREMENT_SECONDS } from '../config';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useT } from '../i18n/i18n';
import { closestElement } from '../lib/dom';
import { formatAverageSessionTime, formatDurationHoursMinutes, formatSecondsAsHHMM } from '../lib/durations';
import { useStore } from '../lib/store';
import { MissionCard } from '../session/MissionCard';
import { validateMissionFields, type MissionValidationError } from '../session/plan';
import { Screen } from '../shared/Screen';
import { RoomHistory } from './RoomHistory';
import { RoomMenuItems } from './RoomMenuItems';
import { RoomRanking } from './RoomRanking';
import { runRoomMenuAction } from './menu';
import { handleRoomBack, isPollingRoom, pollRoom, retryRoom, roomMenuHooks, setRoomMenuState } from './room';
import { roomSessionStore } from './room-session-state';
import { startRoomWork } from './room-session';
import { roomStore } from './state';

/** Draw the Room screen. */
export function RoomScreen() {
    const t = useT();
    const { view, snapshot, menuOpen, busyAction } = useStore(roomStore);
    const { isBusy: isSessionBusy } = useStore(roomSessionStore);
    const [mission, setMission] = useState('');
    const [targetTime, setTargetTime] = useState('00:00');
    const [error, setError] = useState<MissionValidationError | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);
    const missionInputRef = useRef<HTMLInputElement>(null);
    const targetTimeInputRef = useRef<HTMLInputElement>(null);

    useDocumentEvent('click', /** Close the top bar menu when clicking outside it. */ (event) => {
        if (!menuOpen || busyAction !== null) return;
        if (closestElement(event.target, '#room-menu-wrapper, .modal-overlay', Element)) return;
        setRoomMenuState(false);
    });

    useDocumentEvent('keydown', /** Close the top bar menu with Escape. */ (event) => {
        if (event.key === 'Escape' && menuOpen && busyAction === null) setRoomMenuState(false);
    });

    useDocumentEvent('visibilitychange', /** Refresh the room as soon as the tab is visible again. */ () => {
        if (!document.hidden && isPollingRoom()) void pollRoom();
    });

    /** Validate the mission card, then show Focus and start the room session. */
    function handleStartWork(): void {
        if (roomSessionStore.get().active) return;
        const validationError = validateMissionFields(mission, targetTime);
        setError(validationError);
        if (validationError) {
            (validationError.field === 'mission' ? missionInputRef : targetTimeInputRef).current?.focus();
            return;
        }
        void startRoomWork(mission, targetTime);
    }

    /** Fill the target time with the room average plus the beat increment. */
    function handleBeatAverage(): void {
        const average = snapshot?.summary.average_session_time_seconds ?? null;
        if (average === null) {
            missionInputRef.current?.focus();
            return;
        }
        setTargetTime(formatSecondsAsHHMM(average + BEAT_AVERAGE_INCREMENT_SECONDS));
        if (error?.field === 'targetTime') setError(null);
    }

    /** Retry loading the room after a failed first load. */
    async function handleRetry(): Promise<void> {
        if (isRetrying) return;
        setIsRetrying(true);
        try {
            await retryRoom();
        } finally {
            setIsRetrying(false);
        }
    }

    return (
        <Screen name="room" className="room-screen">

            <div className="room-container">

                <div className="room-topbar">
                    <button type="button" id="room-back-btn" className="room-icon-btn" aria-label={t('rooms.back')} onClick={() => { void handleRoomBack(); }}>
                        <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                    </button>
                    <h1 id="room-title" className="room-title" hidden={view !== 'ready'}>{snapshot?.room.name}</h1>
                    <div id="room-title-skeleton" className="dashboard-skeleton room-title-skeleton" aria-hidden="true" hidden={view !== 'loading'}></div>
                    <div id="room-menu-wrapper" className="room-menu-wrapper" style={{ display: view === 'ready' ? 'block' : 'none' }}>
                        <button
                            type="button"
                            id="room-menu-btn"
                            className="room-icon-btn"
                            aria-label={t('rooms.openRoomMenu')}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={() => { setRoomMenuState(!menuOpen); }}
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
                        </button>
                        <div id="room-menu" className="room-menu" role="menu" hidden={!menuOpen}>
                            {menuOpen && snapshot && (
                                <RoomMenuItems
                                    room={snapshot.room}
                                    busyAction={busyAction}
                                    onAction={(action) => { void runRoomMenuAction(action, snapshot.room, roomMenuHooks); }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div id="room-loading" className="room-loading" role="status" aria-label={t('rooms.loadingRoom')} style={{ display: view === 'loading' ? 'flex' : 'none' }}>
                    <div className="dashboard-skeleton room-skeleton-summary" aria-hidden="true"></div>
                    <div className="dashboard-skeleton room-skeleton-mission" aria-hidden="true"></div>
                    <section className="room-section" aria-hidden="true">
                        <h2 className="dashboard-content-title">{t('rooms.ranking')}</h2>
                        <div className="dashboard-skeleton room-skeleton-ranking"></div>
                    </section>
                    <section className="room-section" aria-hidden="true">
                        <h2 className="dashboard-content-title">{t('rooms.history')}</h2>
                        <div className="dashboard-skeleton room-skeleton-history"></div>
                    </section>
                </div>

                <div id="room-data" className="room-data" style={{ display: view === 'ready' ? 'flex' : 'none' }}>

                    <div className="room-summary-container">
                        <div className="dashboard-summary-grid">
                            <div className="dashboard-summary-card">
                                <p id="room-total-time" className="dashboard-summary-value">
                                    {snapshot ? formatDurationHoursMinutes(snapshot.summary.total_time_seconds) : ''}
                                </p>
                                <p className="dashboard-summary-label">{t('review.focused')}</p>
                            </div>
                            <div className="dashboard-summary-card">
                                <p id="room-session-count" className="dashboard-summary-value">
                                    {snapshot ? String(snapshot.summary.total_sessions) : ''}
                                </p>
                                <p className="dashboard-summary-label">{t('review.sessions')}</p>
                            </div>
                            <div className="dashboard-summary-card">
                                <p id="room-people-count" className="dashboard-summary-value">
                                    {snapshot ? String(snapshot.summary.members_count) : ''}
                                </p>
                                <p className="dashboard-summary-label">{t('review.people')}</p>
                            </div>
                            <div className="dashboard-summary-card">
                                <p id="room-average-time" className="dashboard-summary-value">
                                    {snapshot ? formatAverageSessionTime(snapshot.summary.average_session_time_seconds) : ''}
                                </p>
                                <p className="dashboard-summary-label">{t('review.averageSessionTime')}</p>
                                <button type="button" id="room-beat-btn" className="room-beat-btn" onClick={handleBeatAverage}>{t('rooms.beatIt')}</button>
                            </div>
                        </div>
                    </div>

                    <MissionCard
                        idPrefix="room"
                        className="plan-input-section room-mission-card"
                        mission={mission}
                        targetTime={targetTime}
                        error={error}
                        missionInputRef={missionInputRef}
                        targetTimeInputRef={targetTimeInputRef}
                        onMissionChange={(value) => {
                            setMission(value);
                            if (error?.field === 'mission') setError(null);
                        }}
                        onTargetTimeChange={(value) => {
                            setTargetTime(value);
                            if (error?.field === 'targetTime') setError(null);
                        }}
                        onStart={handleStartWork}
                        startDisabled={isSessionBusy}
                    >
                        <p id="room-start-error" className="form-error-message plan-field-error" role="alert"></p>
                    </MissionCard>

                    <section className="room-section">
                        <h2 id="room-ranking-title" className="dashboard-content-title">
                            {snapshot ? t('rooms.rankingTitle', { count: snapshot.summary.members_count }) : ''}
                        </h2>
                        <RoomRanking ranking={snapshot?.ranking ?? []} />
                    </section>

                    <section className="room-section">
                        <h2 className="dashboard-content-title">{t('rooms.history')}</h2>
                        <RoomHistory />
                    </section>

                </div>

                <div id="room-error" className="dashboard-error" role="alert" style={{ display: view === 'error' ? 'flex' : 'none' }}>
                    <p className="dashboard-error-message">{t('dashboard.unreachable')}<br />{t('dashboard.tryAgainSoon')}</p>
                    <button type="button" id="room-retry-btn" disabled={isRetrying} onClick={() => { void handleRetry(); }}>
                        {isRetrying ? t('loading.retrying') : t('common.retry')}
                    </button>
                </div>

                <div id="room-unavailable" className="empty-dashboard-cta-container" style={{ display: view === 'unavailable' ? 'flex' : 'none' }}>
                    <h2 className="empty-dashboard-cta-title">{t('rooms.unavailableTitle')}</h2>
                    <p className="empty-dashboard-cta-paragraph">{t('rooms.unavailableText')}</p>
                    <button type="button" id="room-unavailable-back-btn" className="empty-dashboard-start-mission-btn white-filled-button" onClick={() => { void handleRoomBack(); }}>
                        {t('rooms.back')}
                    </button>
                </div>

            </div>

        </Screen>
    );
}
