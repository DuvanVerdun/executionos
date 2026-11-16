import { createPortal } from 'react-dom';
import { formatDuration } from '../lib/durations';
import type { LiveSession } from '../types/rooms';

/** The point above a row where its summary card hangs. */
export interface Anchor {
    x: number;
    y: number;
}

/**
 * Draw the summary card of someone who is working: the mission when they show it, the time worked, the target, and the percentage.
 * It is drawn in the page body, so no card around the row clips it.
 */
export function LiveSessionCard({ session, worked, anchor }: { session: LiveSession; worked: number; anchor: Anchor }) {
    const percentage = Math.floor(worked / session.target_time_seconds * 100);
    return createPortal(
        <div className="streak-day-summary room-live-summary" role="tooltip" style={{ left: anchor.x, top: anchor.y }}>
            {session.mission !== null && <p>{session.mission}</p>}
            <p className="streak-day-summary-detail">
                {`${formatDuration(Math.floor(worked))} / ${formatDuration(session.target_time_seconds)} · ${percentage}%`}
            </p>
        </div>,
        document.body
    );
}
