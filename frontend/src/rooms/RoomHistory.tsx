import { useRef, useState, type ReactNode } from 'react';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useInView } from '../hooks/useInView';
import { useT } from '../i18n/i18n';
import { at } from '../lib/arrays';
import { formatSessionDateLabel, groupSessionsByLocalDate } from '../lib/dates';
import { closestElement } from '../lib/dom';
import { formatDurationHoursMinutes } from '../lib/durations';
import { useStore } from '../lib/store';
import { SessionMenu, SessionTimeSection } from '../shared/SessionCard';
import type { RoomHistorySession } from '../types/rooms';
import type { DailySummary } from '../types/session';
import { handleRoomHistoryRetry, loadMoreRoomSessions, loadRoom } from './room';
import { roomStore } from './state';

/** Draw the aggregated metrics of one day of room sessions. */
function RoomDailySummarySection({ summary }: { summary: DailySummary }) {
    const t = useT();
    return (
        <div className="dashboard-daily-summary">
            <p className="dashboard-daily-summary-title">{t('dashboard.dailySummary')}</p>
            <div className="dashboard-daily-summary-metrics">
                <p>{t('dashboard.dailySessions', { count: summary.total_sessions })}</p>
                <p>{t('session.focused', { time: formatDurationHoursMinutes(summary.total_time_seconds) })}</p>
                <p>{t('session.completion', { percentage: Math.round(summary.average_completion_percentage) })}</p>
            </div>
        </div>
    );
}

/** A session with the dividing line before it, when it has one. */
function SessionBlock({ showDivider, children }: { showDivider: boolean; children: ReactNode }) {
    return (
        <>
            {showDivider && <span className="dashboard-session-division-line"></span>}
            {children}
        </>
    );
}

/** Draw a room session's author, mission, and delete menu, then its times. */
function RoomSessionRow({ session, isMenuOpen, onToggleMenu }: { session: RoomHistorySession; isMenuOpen: boolean; onToggleMenu: () => void }) {
    const t = useT();
    return (
        <>
            <div className="dashboard-session-mission-container">
                <div className="room-session-info">
                    <p className="room-session-user">
                        <span className="room-session-username">{session.username}</span>
                        {session.is_former_member && <span className="room-session-former"> {t('rooms.formerMember')}</span>}
                    </p>
                    <p className="dashboard-session-mission">{session.mission_hidden ? t('rooms.missionHidden') : session.mission}</p>
                </div>
                {session.is_mine && (
                    <SessionMenu
                        sessionId={session.id}
                        screen="room"
                        isOpen={isMenuOpen}
                        onToggle={onToggleMenu}
                        reload={() => loadRoom({ silent: true, reloadHistory: true })}
                    />
                )}
            </div>
            <SessionTimeSection session={session} />
        </>
    );
}

/** Draw the room history. */
export function RoomHistory() {
    const t = useT();
    const { sessions, dailySummaries, nextCursor, historyLoaded, historyFailure, historyMessage, isLoading, isLoadingMore } = useStore(roomStore);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useDocumentEvent('click', /** Close history menus when clicking outside their controls. */ (event) => {
        if (closestElement(event.target, '.dashboard-session-menu, .dashboard-session-open-menu-icon', Element)) return;
        setOpenMenuId(null);
    });

    useInView(
        sentinelRef,
        () => { void loadMoreRoomSessions(); },
        nextCursor !== null && historyFailure === null && !isLoading,
        `${sessions.length}:${isLoadingMore}`
    );

    const groups = [...groupSessionsByLocalDate(sessions).entries()];

    return (
        <>
            <div id="room-history" className="room-history">
                {groups.map(/** Draw the card of one local day. */ ([dateKey, daySessions]) => {
                    const dailySummary = dailySummaries[dateKey];
                    const hasSummary = dailySummary !== undefined && dailySummary.total_sessions > 1;
                    return (
                        <div key={dateKey} className="dashboard-session-card">
                            <p className="dashboard-session-date">{formatSessionDateLabel(at(daySessions, 0))}</p>
                            {hasSummary && <RoomDailySummarySection summary={dailySummary} />}
                            {daySessions.map(/** Draw a session and its separator. */ (session, index) => (
                                <SessionBlock key={session.id} showDivider={index > 0 || hasSummary}>
                                    <RoomSessionRow
                                        session={session}
                                        isMenuOpen={openMenuId === session.id}
                                        onToggleMenu={() => { setOpenMenuId(openMenuId === session.id ? null : session.id); }}
                                    />
                                </SessionBlock>
                            ))}
                        </div>
                    );
                })}
            </div>
            <div id="room-history-empty" className="room-history-empty" style={{ display: historyLoaded && sessions.length === 0 ? 'flex' : 'none' }}>
                <h3 className="room-history-empty-title">{t('rooms.historyEmptyTitle')}</h3>
                <p className="room-history-empty-text">{t('rooms.historyEmptyText')}</p>
            </div>
            <div
                ref={sentinelRef}
                id="room-history-sentinel"
                className="room-history-sentinel"
                style={{ display: historyFailure !== null || nextCursor !== null ? 'flex' : 'none' }}
            >
                <p id="room-history-message" role="status" aria-live="polite">{historyMessage}</p>
                <button type="button" id="room-history-retry-btn" hidden={historyFailure === null} onClick={() => { void handleRoomHistoryRetry(); }}>{t('common.retry')}</button>
            </div>
        </>
    );
}
