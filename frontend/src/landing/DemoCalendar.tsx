import { useEffect, useState } from 'react';
import { useT, type TranslationKey } from '../i18n/i18n';
import { parseLocalDate } from '../lib/dates';
import { DaySummaryContent } from '../streak/DaySummaryContent';
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
    return (
        <div className="streak-day-summary landing-day-summary" role="tooltip">
            <DaySummaryContent day={day} detailClassName="landing-day-summary-detail" />
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
    /** How long the mouse must stay away from the days before the highlighted date shows. Without it, the date shows at once. */
    highlightDelayMs?: number;
}

/** Draw days like the consistency calendar of the app does. The summary card of a day shows when the mouse is over it. The highlighted date shows only after the mouse has been away for a while, so the card never jumps between two days. */
export function DemoCalendarGrid({ days, leadingBlanks = 0, showWeekdays = false, highlightedDate = null, highlightDelayMs = 0 }: DemoCalendarGridProps) {
    const t = useT();
    const [hoveredDate, setHoveredDate] = useState<string | null>(null);
    const [readyDate, setReadyDate] = useState<string | null>(null);
    const defaultDate = highlightDelayMs === 0 || readyDate === highlightedDate ? highlightedDate : null;
    const shownDate = hoveredDate ?? defaultDate;

    useEffect(() => {
        if (highlightedDate === null || hoveredDate !== null || highlightDelayMs === 0) return;
        const timer = setTimeout(() => { setReadyDate(highlightedDate); }, highlightDelayMs);
        return () => { clearTimeout(timer); };
    }, [highlightedDate, hoveredDate, highlightDelayMs]);

    return (
        <div className="streak-calendar landing-calendar-grid">
            {showWeekdays && WEEKDAYS.map(/** Draw a weekday heading. */ (weekday) => <span key={weekday}>{t(weekday)}</span>)}
            {Array.from({ length: leadingBlanks }, /** Draw an empty cell before the first day. */ (_, index) => <span key={`blank-${index}`} />)}
            {days.map(/** Draw a day with its state. */ (day) => (
                <span
                    key={day.date}
                    className={`streak-calendar-day streak-calendar-day-${getVisualState(day)}${shownDate === day.date ? ' is-highlighted' : ''}`}
                    onMouseEnter={() => { setReadyDate(null); setHoveredDate(day.date); }}
                    onMouseLeave={() => { setHoveredDate(null); }}
                >
                    {parseLocalDate(day.date).getDate()}
                    {shownDate === day.date && <DaySummary day={day} />}
                </span>
            ))}
        </div>
    );
}
