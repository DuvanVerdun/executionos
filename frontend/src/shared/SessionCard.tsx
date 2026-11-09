import { useState } from 'react';
import { formatDurationHoursMinutes } from '../lib/durations';
import { deleteSession } from '../session/api';
import type { ScreenName } from '../types/screens';
import type { HistorySession } from '../types/session';

/** Draw a session's target, focused time, and completion metrics. */
export function SessionTimeSection({ session }: {
    session: Pick<HistorySession, 'target_time_seconds' | 'actual_time_seconds' | 'percentage_completed'>;
}) {
    return (
        <div className="dashboard-session-time-and-percentage-container">
            <p className="dashboard-session-target-time">{`${formatDurationHoursMinutes(session.target_time_seconds)} target`}</p>
            <p className="dashboard-session-actual-time">{`${formatDurationHoursMinutes(session.actual_time_seconds)} focused`}</p>
            <p className="dashboard-session-percentage">{`${Math.floor(session.percentage_completed)}% completion`}</p>
        </div>
    );
}

interface SessionMenuProps {
    sessionId: number;
    /** The screen the card is on. Deleting needs it, in case the sign-in is lost. */
    screen: ScreenName;
    isOpen: boolean;
    onToggle: () => void;
    /** Reload the data that shows the session, after it is deleted. */
    reload: () => Promise<void>;
}

/** Draw the menu icon of a session and its menu with the Delete button. */
export function SessionMenu({ sessionId, screen, isOpen, onToggle, reload }: SessionMenuProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [hasFailed, setHasFailed] = useState(false);

    /** Delete the session, then reload the Dashboard or Room data. */
    async function handleDelete(): Promise<void> {
        if (!confirm('Delete this session?')) return;
        setHasFailed(false);
        setIsDeleting(true);
        try {
            const result = await deleteSession(String(sessionId), screen);
            if (!result.success) throw new Error('Deletion failed');
            await reload();
        } catch {
            setHasFailed(true);
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <>
            <span
                className="material-symbols-outlined dashboard-session-open-menu-icon dashboard-session-toggle-menu-icon"
                onClick={onToggle}
            >
                more_vert
            </span>
            <div className="dashboard-session-menu" style={isOpen ? { display: 'flex' } : undefined}>
                <button
                    className="dashboard-delete-session-btn"
                    data-session-id={sessionId}
                    disabled={isDeleting}
                    onClick={() => { void handleDelete(); }}
                >
                    {isDeleting ? 'Deleting…' : 'Delete Session'}
                </button>
                {hasFailed && (
                    <p className="form-error-message" role="alert">Couldn’t delete this session. Try again.</p>
                )}
            </div>
        </>
    );
}
