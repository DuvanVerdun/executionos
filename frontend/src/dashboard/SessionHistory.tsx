import { useRef, useState, type ReactNode } from 'react';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useInView } from '../hooks/useInView';
import { useT } from '../i18n/i18n';
import { at } from '../lib/arrays';
import { closestElement } from '../lib/dom';
import { formatSessionDateLabel, groupSessionsByLocalDate } from '../lib/dates';
import { formatDurationHoursMinutes } from '../lib/durations';
import { useStore } from '../lib/store';
import { SessionMenu, SessionTimeSection } from '../shared/SessionCard';
import type { DailySummary, HistorySession } from '../types/session';
import { dashboardStore, loadDashboard, loadMoreSessions, retryPagination } from './dashboard';

/** Draw the aggregated metrics of a day of sessions. */
function DailySummarySection({ summary }: { summary: DailySummary }) {
    const t = useT();
    return (
        <div className="dashboard-daily-summary">
            <p className="dashboard-daily-summary-title">{t('dashboard.dailySummary')}</p>
            <div className="dashboard-daily-summary-metrics">
                <p>{t('dashboard.dailySessions', { count: summary.total_sessions })}</p>
                <p>{t('session.focused', { time: formatDurationHoursMinutes(summary.total_time_seconds) })}</p>
                <p>{t('dashboard.dailyCompletion', { percentage: Math.round(summary.average_completion_percentage) })}</p>
            </div>
        </div>
    );
}

interface SessionRowProps {
    session: HistorySession;
    isMenuOpen: boolean;
    onToggleMenu: () => void;
}

/** Draw a session's mission and menu, then its times. */
function SessionRow({ session, isMenuOpen, onToggleMenu }: SessionRowProps) {
    return (
        <>
            <div className="dashboard-session-mission-container">
                <p className="dashboard-session-mission">{session.mission}</p>
                <SessionMenu
                    sessionId={session.id}
                    screen="dashboard"
                    isOpen={isMenuOpen}
                    onToggle={onToggleMenu}
                    reload={() => loadDashboard()}
                />
            </div>
            <SessionTimeSection session={session} />
        </>
    );
}

/** Draw the session history, or a message when the period has no sessions. */
export function SessionHistory() {
    const t = useT();
    const { sessions, dailySummaries, nextCursor, isLoading, isLoadingMore, paginationFailed, paginationMessage } = useStore(dashboardStore);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useDocumentEvent('click', /** Close history menus when clicking outside their controls. */ (event) => {
        if (closestElement(event.target, '.dashboard-session-menu, .dashboard-session-open-menu-icon, .modal-overlay', Element)) return;
        setOpenMenuId(null);
    });

    useInView(
        sentinelRef,
        () => { void loadMoreSessions(); },
        !isLoading && nextCursor !== null && !paginationFailed,
        `${sessions.length}:${isLoadingMore}`
    );

    if (sessions.length === 0) {
        return (
            <div id="dashboard-sessions-list-container">
                <h2 className="dashboard-content-title">{t('dashboard.sessionHistory')}</h2>
                <p className="dashboard-empty-period-message">{t('dashboard.noSessions')}</p>
            </div>
        );
    }

    const groups = [...groupSessionsByLocalDate(sessions).entries()];

    return (
        <div id="dashboard-sessions-list-container">
            <h2 className="dashboard-content-title">{t('dashboard.sessionHistory')}</h2>
            {groups.map(/** Draw the card of one local day. */ ([dateKey, daySessions]) => {
                const dailySummary = dailySummaries[dateKey];
                const hasSummary = dailySummary !== undefined && dailySummary.total_sessions > 1;
                const firstSession = at(daySessions, 0);
                return (
                    <div key={dateKey} className="dashboard-session-card" id={`session-card-${dateKey}`}>
                        <p className="dashboard-session-date">{formatSessionDateLabel(firstSession)}</p>
                        {hasSummary && <DailySummarySection summary={dailySummary} />}
                        {daySessions.map(/** Draw a session and its separator. */ (session, index) => (
                            <SessionBlock key={session.id} showDivider={index > 0 || hasSummary}>
                                <SessionRow
                                    session={session}
                                    isMenuOpen={openMenuId === session.id}
                                    onToggleMenu={() => { setOpenMenuId(openMenuId === session.id ? null : session.id); }}
                                />
                            </SessionBlock>
                        ))}
                    </div>
                );
            })}
            <div ref={sentinelRef} id="dashboard-sessions-load-sentinel" style={{ display: !isLoading && nextCursor !== null ? 'flex' : 'none' }}>
                <p id="dashboard-pagination-message" role="status" aria-live="polite">{paginationMessage}</p>
                <button type="button" id="dashboard-pagination-retry-btn" hidden={!paginationFailed} onClick={retryPagination}>{t('common.retry')}</button>
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
