import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useT, type TranslationKey } from '../i18n/i18n';
import { at } from '../lib/arrays';
import { parseLocalDate } from '../lib/dates';
import { formatDurationHoursMinutes } from '../lib/durations';
import { useStore } from '../lib/store';
import type { CalendarDay } from '../types/dashboard';
import type { HeaderScreenName } from '../types/screens';
import { loadStreak, shiftStreakMonth, streakStore } from './streak';

const WEEKDAYS = [
    'streak.monday', 'streak.tuesday', 'streak.wednesday', 'streak.thursday', 'streak.friday', 'streak.saturday', 'streak.sunday'
] as const satisfies readonly TranslationKey[];

const LEGEND = [
    { state: 'work', label: 'streak.legendWork' },
    { state: 'rest', label: 'streak.legendRest' },
    { state: 'today', label: 'streak.legendToday' }
] as const satisfies readonly { state: string; label: TranslationKey }[];

/** The day under the mouse, and the point above it where its summary card hangs. */
interface HoveredDay {
    day: CalendarDay;
    x: number;
    y: number;
}

/**
 * Draw the summary card of a day: its sessions and its time.
 * It is drawn in the page body, because the calendar popup clips and blurs everything inside it.
 */
function DaySummaryCard({ hovered }: { hovered: HoveredDay }) {
    const t = useT();
    const { day } = hovered;
    return createPortal(
        <div className="streak-day-summary" role="tooltip" style={{ left: hovered.x, top: hovered.y }}>
            {day.total_sessions === 0 ? (
                <p>{t('streak.noSessions')}</p>
            ) : (
                <>
                    <p>{day.total_sessions === 1 ? t('streak.sessionsOne') : t('streak.sessionsOther', { count: day.total_sessions })}</p>
                    <p>{t('session.focused', { time: formatDurationHoursMinutes(day.total_time_seconds) })}</p>
                </>
            )}
        </div>,
        document.body
    );
}

/** Build the consistency calendar and its month navigation controls. */
export function StreakPopup({ screen }: { screen: HeaderScreenName }) {
    const t = useT();
    const { view, calendar, restDaysRemaining, totalWorkedDays, openScreen } = useStore(streakStore);
    const [hovered, setHovered] = useState<HoveredDay | null>(null);
    if (view === 'idle') return null;

    const isLoading = view === 'loading';
    const title = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric'
    }).format(parseLocalDate(`${calendar.month}-01`));

    const header = (
        <div className="streak-calendar-header">
            <button type="button" aria-label={t('streak.previousMonth')} onClick={() => { shiftStreakMonth(-1, screen); }}>{'<'}</button>
            <p>{title}</p>
            <button type="button" aria-label={t('streak.nextMonth')} onClick={() => { shiftStreakMonth(1, screen); }}>{'>'}</button>
        </div>
    );

    if (view === 'failed') {
        return (
            <>
                {header}
                <div className="streak-calendar-error">
                    <p role="alert">{t('streak.loadFailed')}</p>
                    <button type="button" className="normal-button" onClick={() => { void loadStreak(screen); }}>{t('common.retry')}</button>
                </div>
            </>
        );
    }

    const firstDay = parseLocalDate(at(calendar.days, 0).date);
    const emptyCellsBeforeFirstDay = (firstDay.getDay() + 6) % 7;

    return (
        <>
            {header}
            <div
                className="streak-calendar"
                aria-busy={isLoading}
                aria-label={isLoading ? t('streak.loading') : undefined}
            >
                {WEEKDAYS.map(/** Draw a weekday heading. */ (weekday) => <span key={weekday}>{t(weekday)}</span>)}
                {Array.from({ length: emptyCellsBeforeFirstDay }, /** Draw an empty cell before the first day. */ (_, index) => <span key={`empty-${index}`} />)}
                {calendar.days.map(/** Draw a day with its work, rest, today, or neutral state. */ (day) => {
                    const visualState = day.state === 'work' || day.state === 'rest' || day.state === 'today' ? day.state : 'neutral';
                    return (
                        <span
                            key={day.date}
                            className={`streak-calendar-day streak-calendar-day-${visualState}`}
                            aria-hidden={isLoading ? true : undefined}
                            onMouseEnter={isLoading ? undefined : (event) => {
                                const box = event.currentTarget.getBoundingClientRect();
                                setHovered({ day, x: box.left + box.width / 2, y: box.top });
                            }}
                            onMouseLeave={() => { setHovered(null); }}
                        >
                            {parseLocalDate(day.date).getDate()}
                        </span>
                    );
                })}
            </div>
            {hovered !== null && openScreen === screen && <DaySummaryCard hovered={hovered} />}
            {isLoading ? (
                <div className="dashboard-skeleton streak-calendar-loading-footer" aria-hidden="true" />
            ) : (
                <>
                    <div className="streak-calendar-footer">
                        <div className="streak-calendar-legend">
                            {LEGEND.map(/** Draw a legend entry. */ ({ state, label }) => (
                                <div key={state}>
                                    <span className={`streak-calendar-legend-marker streak-calendar-day-${state}`} aria-hidden="true" />
                                    <span>{t(label)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="streak-calendar-total">
                            <p className="streak-calendar-total-value">{totalWorkedDays ?? '—'}</p>
                            <p className="streak-calendar-total-label">{t('streak.totalDays')}</p>
                        </div>
                    </div>
                    <p className="streak-calendar-rest-days">
                        {restDaysRemaining === 1 ? t('streak.restDaysOne') : t('streak.restDaysOther', { count: restDaysRemaining })}
                    </p>
                </>
            )}
        </>
    );
}
