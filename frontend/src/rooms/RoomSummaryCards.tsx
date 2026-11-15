import type { ReactNode } from 'react';
import { useT } from '../i18n/i18n';
import { formatAverageSessionTime, formatDurationHoursMinutes } from '../lib/durations';
import type { RoomSummary } from '../types/rooms';

interface RoomSummaryCardsProps {
    /** The room's totals. Null shows dashes. */
    summary: RoomSummary | null;
    /** What goes under the average session time. Its slot keeps its height when empty, so Room and Review have the same cards. */
    averageFooter?: ReactNode;
}

/** Draw the four summary cards of a room: time focused, sessions, people, and average session time. */
export function RoomSummaryCards({ summary, averageFooter }: RoomSummaryCardsProps) {
    const t = useT();
    return (
        <div className="room-summary-container">
            <div className="dashboard-summary-grid">
                <div className="dashboard-summary-card">
                    <p id="room-total-time" className="dashboard-summary-value">
                        {summary ? formatDurationHoursMinutes(summary.total_time_seconds) : '—'}
                    </p>
                    <p className="dashboard-summary-label">{t('review.focused')}</p>
                </div>
                <div className="dashboard-summary-card">
                    <p id="room-session-count" className="dashboard-summary-value">
                        {summary ? String(summary.total_sessions) : '—'}
                    </p>
                    <p className="dashboard-summary-label">{t('review.sessions')}</p>
                </div>
                <div className="dashboard-summary-card">
                    <p id="room-people-count" className="dashboard-summary-value">
                        {summary ? String(summary.members_count) : '—'}
                    </p>
                    <p className="dashboard-summary-label">{t('review.people')}</p>
                </div>
                <div className="dashboard-summary-card">
                    <p id="room-average-time" className="dashboard-summary-value">
                        {summary ? formatAverageSessionTime(summary.average_session_time_seconds) : '—'}
                    </p>
                    <p className="dashboard-summary-label">{t('review.averageSessionTime')}</p>
                    <div className="room-summary-footer">{averageFooter}</div>
                </div>
            </div>
        </div>
    );
}
