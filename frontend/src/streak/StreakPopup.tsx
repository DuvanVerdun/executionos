import { useT, type TranslationKey } from '../i18n/i18n';
import { at } from '../lib/arrays';
import { parseLocalDate } from '../lib/dates';
import { useStore } from '../lib/store';
import type { HeaderScreenName } from '../types/screens';
import { loadStreak, shiftStreakMonth, streakStore } from './streak';

const WEEKDAYS = [
    'streak.monday', 'streak.tuesday', 'streak.wednesday', 'streak.thursday', 'streak.friday', 'streak.saturday', 'streak.sunday'
] as const satisfies readonly TranslationKey[];

const LEGEND = [
    { state: 'work', label: 'streak.legendWork' },
    { state: 'rest', label: 'streak.legendRest' }
] as const satisfies readonly { state: string; label: TranslationKey }[];

const DAY_TITLES = {
    work: 'streak.dayWork',
    rest: 'streak.dayRest',
    neutral: 'streak.dayNeutral'
} as const satisfies Record<string, TranslationKey>;

/** Build the consistency calendar and its month navigation controls. */
export function StreakPopup({ screen }: { screen: HeaderScreenName }) {
    const t = useT();
    const { view, calendar, restDaysRemaining } = useStore(streakStore);
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
                {calendar.days.map(/** Draw a day with its work, rest, or neutral state. */ (day) => {
                    const visualState = day.state === 'work' || day.state === 'rest' ? day.state : 'neutral';
                    return (
                        <span
                            key={day.date}
                            className={`streak-calendar-day streak-calendar-day-${visualState}`}
                            aria-hidden={isLoading ? true : undefined}
                            title={isLoading ? undefined : t(DAY_TITLES[visualState])}
                        >
                            {parseLocalDate(day.date).getDate()}
                        </span>
                    );
                })}
            </div>
            {isLoading ? (
                <div className="dashboard-skeleton streak-calendar-loading-footer" aria-hidden="true" />
            ) : (
                <>
                    <div className="streak-calendar-legend">
                        {LEGEND.map(/** Draw a legend entry. */ ({ state, label }) => (
                            <div key={state}>
                                <span className={`streak-calendar-legend-marker streak-calendar-day-${state}`} aria-hidden="true" />
                                <span>{t(label)}</span>
                            </div>
                        ))}
                    </div>
                    <p className="streak-calendar-rest-days">
                        {restDaysRemaining === 1 ? t('streak.restDaysOne') : t('streak.restDaysOther', { count: restDaysRemaining })}
                    </p>
                </>
            )}
        </>
    );
}
