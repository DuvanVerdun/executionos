import { useState } from 'react';
import { useT, type TranslationKey } from '../i18n/i18n';
import { formatShortDate, parseLocalDate } from '../lib/dates';
import { formatDurationHoursMinutes } from '../lib/durations';
import type { CalendarDay } from '../types/dashboard';

const WEEKDAYS = [
    'streak.monday', 'streak.tuesday', 'streak.wednesday', 'streak.thursday', 'streak.friday', 'streak.saturday', 'streak.sunday'
] as const satisfies readonly TranslationKey[];

/** Return how a day looks. A day without work looks like a day that has not come yet. */
function getVisualState(day: CalendarDay): 'work' | 'rest' | 'today' | 'neutral' {
    return day.state === 'work' || day.state === 'rest' || day.state === 'today' ? day.state : 'neutral';
}

/** Draw the summary card of a day: its date, and what it holds. It hangs above the day. */
function DaySummary({ day }: { day: CalendarDay }) {
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
        <div className="streak-day-summary landing-day-summary" role="tooltip">
            <p>{formatShortDate(parseLocalDate(day.date))}</p>
            <p className="landing-day-summary-detail">{detail}</p>
        </div>
    );
}

interface DemoCalendarGridProps {
    days: readonly CalendarDay[];
    /** Empty cells before the first day, so that the days fall under their weekday. */
    leadingBlanks?: number;
    /** Draw the weekday headings above the days. */
    showWeekdays?: boolean;
    /** The date whose summary card shows when the mouse is not over a day. */
    highlightedDate?: string | null;
}

/** Draw days like the consistency calendar of the app does. The summary card of a day shows when the mouse is over it. */
export function DemoCalendarGrid({ days, leadingBlanks = 0, showWeekdays = false, highlightedDate = null }: DemoCalendarGridProps) {
    const t = useT();
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const shownDate = hoveredDate ?? highlightedDate;

    return (
        <div className="streak-calendar landing-calendar-grid">
            {showWeekdays && WEEKDAYS.map(/** Draw a weekday heading. */ (weekday) => <span key={weekday}>{t(weekday)}</span>)}
            {Array.from({ length: leadingBlanks }, /** Draw an empty cell before the first day. */ (_, index) => <span key={`blank-${index}`} />)}
            {days.map(/** Draw a day with its state. */ (day) => (
                <span
                    key={day.date}
                    className={`streak-calendar-day streak-calendar-day-${getVisualState(day)}${shownDate === day.date ? ' is-highlighted' : ''}`}
                    onMouseEnter={() => { setHoveredDate(day.date); }}
                    onMouseLeave={() => { setHoveredDate(null); }}
                >
                    {parseLocalDate(day.date).getDate()}
                    {shownDate === day.date && <DaySummary day={day} />}
                </span>
            ))}
        </div>
    );
}
