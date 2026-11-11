import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/i18n';
import { formatDurationHoursMinutes } from '../lib/durations';
import { deleteSession } from '../session/api';
import type { ScreenName } from '../types/screens';
import type { HistorySession } from '../types/session';
import { confirmAction } from './confirm';
import { EditMissionModal } from './EditMissionModal';

/** Draw a session's target, focused time, and completion metrics. */
export function SessionTimeSection({ session }: {
    session: Pick<HistorySession, 'target_time_seconds' | 'actual_time_seconds' | 'percentage_completed'>;
}) {
    const t = useT();
    return (
        <div className="dashboard-session-time-and-percentage-container">
            <p className="dashboard-session-target-time">{t('session.target', { time: formatDurationHoursMinutes(session.target_time_seconds) })}</p>
            <p className="dashboard-session-actual-time">{t('session.focused', { time: formatDurationHoursMinutes(session.actual_time_seconds) })}</p>
            <p className="dashboard-session-percentage">{t('session.completion', { percentage: Math.floor(session.percentage_completed) })}</p>
        </div>
    );
}

interface SessionMenuProps {
    sessionId: number;
    /** The mission that the session has now. */
    mission: string;
    /** The screen the card is on. Editing and deleting need it, in case the sign-in is lost. */
    screen: ScreenName;
    isOpen: boolean;
    onToggle: () => void;
    /** Show the new mission on the card, after the server saved it. */
    onMissionChanged: (mission: string) => void;
    /** Reload the data that shows the session, after it is deleted. */
    reload: () => Promise<void>;
}

/** Draw the menu icon of a session and its menu with the Edit Mission and Delete buttons. */
export function SessionMenu({ sessionId, mission, screen, isOpen, onToggle, onMissionChanged, reload }: SessionMenuProps) {
    const t = useT();
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [hasFailed, setHasFailed] = useState(false);

    /** Delete the session, then reload the Dashboard or Room data. */
    async function handleDelete(): Promise<void> {
        if (!await confirmAction({ message: t('session.deleteConfirm'), confirmLabel: t('session.delete') })) return;
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
                    className="dashboard-session-menu-btn"
                    disabled={isDeleting}
                    onClick={() => { onToggle(); setIsEditing(true); }}
                >
                    {t('session.edit')}
                </button>
                <button
                    className="dashboard-session-menu-btn"
                    data-session-id={sessionId}
                    disabled={isDeleting}
                    onClick={() => { void handleDelete(); }}
                >
                    {isDeleting ? t('session.deleting') : t('session.delete')}
                </button>
                {hasFailed && (
                    <p className="form-error-message" role="alert">{t('session.deleteFailed')}</p>
                )}
            </div>
            {isEditing && createPortal(
                <EditMissionModal
                    sessionId={sessionId}
                    mission={mission}
                    screen={screen}
                    onSaved={onMissionChanged}
                    onClose={() => { setIsEditing(false); }}
                />,
                document.body
            )}
        </>
    );
}
