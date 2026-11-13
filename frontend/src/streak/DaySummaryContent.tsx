import { useT } from '../i18n/i18n';
import { formatShortDate, parseLocalDate } from '../lib/dates';
import { formatDurationHoursMinutes } from '../lib/durations';
import type { CalendarDay } from '../types/dashboard';

interface DaySummaryContentProps {
    day: CalendarDay;
    /** The class of the second line, which each calendar sizes with its own unit. */
    detailClassName: string;
}

/** Draw what the summary card of a day says: its date, and what it holds. */
export function DaySummaryContent({ day, detailClassName }: DaySummaryContentProps) {
    const t = useT();
    let detail: string;
    if (day.state === 'work') {
        const sessions = day.total_sessions === 1 ? t('streak.sessionsOne') : t('streak.sessionsOther', { count: day.total_sessions });
        detail = `${sessions} · ${t('session.focused', { time: formatDurationHoursMinutes(day.total_time_seconds) })}`;
    } else if (day.state === 'rest') {
        detail = t('landing.tip.rest');
    } else if (day.state === 'today') {
        detail = t('landing.tip.today');
    } else if (day.state === 'missed') {
        detail = t('streak.noSessions');
    } else {
        detail = t('landing.tip.future');
    }
    return (
        <>
            <p>{formatShortDate(parseLocalDate(day.date))}</p>
            <p className={detailClassName}>{detail}</p>
        </>
    );
}
