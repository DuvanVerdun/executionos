import { useState } from 'react';
import { useT } from '../i18n/i18n';
import { at } from '../lib/arrays';
import { addDays, formatLocalDate, formatMonthAndYear, parseLocalDate } from '../lib/dates';
import { DemoCalendarGrid } from './DemoCalendar';
import { DEMO_TOTAL_WORKED_DAYS, demoCurrentStreak, demoMonthDays, demoRestDaysRemaining } from './demo';

/** Draw the section that shows the consistency calendar and the streak. */
export function StreakSection({ today }: { today: Date }) {
    const t = useT();
    const [isPillHovered, setIsPillHovered] = useState(false);
    const days = demoMonthDays(today);
    const dayBeforeYesterday = formatLocalDate(addDays(today, -2));
    const pillDate = days.some(/** Find the day before yesterday. */ (day) => day.date === dayBeforeYesterday) ? dayBeforeYesterday : null;
    const leadingBlanks = (parseLocalDate(at(days, 0).date).getDay() + 6) % 7;
    const restDaysRemaining = demoRestDaysRemaining(today);

    return (
        <section className="landing-section landing-streak" aria-labelledby="landing-streak-title">
            <div className="landing-streak-copy">
                <p className="landing-kicker">{t('landing.streak.kicker')}</p>
                <h2 id="landing-streak-title" className="landing-title landing-title-left">{t('landing.streak.title')}</h2>
                <p className="landing-lead landing-lead-left">{t('landing.streak.text')}</p>
                <div className="landing-streak-chip" aria-hidden="true">
                    <span>🔥</span>
                    <span className="landing-streak-count">{demoCurrentStreak(today)}</span>
                    <span className="landing-streak-label">{t('landing.streak.days')}</span>
                </div>
                <p
                    className={isPillHovered ? 'landing-hover-pill is-hovered' : 'landing-hover-pill'}
                    onMouseEnter={() => { setIsPillHovered(true); }}
                    onMouseLeave={() => { setIsPillHovered(false); }}
                >
                    {t('landing.streak.hover')}<span aria-hidden="true"> →</span>
                </p>
            </div>
            <div className="landing-calendar">
                <div className="streak-calendar-header">
                    <button type="button" aria-label={t('streak.previousMonth')} disabled>{'<'}</button>
                    <p>{formatMonthAndYear(today)}</p>
                    <button type="button" aria-label={t('streak.nextMonth')} disabled>{'>'}</button>
                </div>
                <DemoCalendarGrid days={days} leadingBlanks={leadingBlanks} showWeekdays highlightedDate={isPillHovered ? pillDate : null} />
                <div className="streak-calendar-footer">
                    <div className="streak-calendar-legend">
                        <div><span className="streak-calendar-legend-marker streak-calendar-day-work" aria-hidden="true" /><span>{t('streak.legendWork')}</span></div>
                        <div><span className="streak-calendar-legend-marker streak-calendar-day-rest" aria-hidden="true" /><span>{t('streak.legendRest')}</span></div>
                        <div><span className="streak-calendar-legend-marker streak-calendar-day-today" aria-hidden="true" /><span>{t('streak.legendToday')}</span></div>
                    </div>
                    <div className="streak-calendar-total">
                        <p className="streak-calendar-total-value">{DEMO_TOTAL_WORKED_DAYS}</p>
                        <p className="streak-calendar-total-label">{t('streak.totalDays')}</p>
                    </div>
                </div>
                <p className="streak-calendar-rest-days">
                    {restDaysRemaining === 1 ? t('streak.restDaysOne') : t('streak.restDaysOther', { count: restDaysRemaining })}
                </p>
            </div>
        </section>
    );
}
