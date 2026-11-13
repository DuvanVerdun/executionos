import { useT } from '../i18n/i18n';
import { formatLongDate } from '../lib/dates';
import { navigateTo } from '../shared/navigation';
import { describeDaysAsCircles, describeDaysLeft } from './copy';
import { MonthStrip } from './MonthStrip';

/** Draw the section that shows how little of the month is left, and what it can still hold. */
export function ClockSection({ today }: { today: Date }) {
    const t = useT();
    return (
        <section className="landing-section landing-clock" aria-labelledby="landing-clock-title">
            <p className="landing-kicker landing-kicker-pain">{t('landing.todayIs', { date: formatLongDate(today) })}</p>
            <h2 id="landing-clock-title" className="landing-title">{describeDaysLeft(today)}</h2>
            <p className="landing-lead">{t('landing.clock.subtitle')}</p>
            <div className="landing-card landing-strips">
                <div>
                    <p className="landing-card-label landing-card-label-pain">{t('landing.clock.idleLabel')}</p>
                    <MonthStrip today={today} mode="idle" />
                </div>
                <div>
                    <p className="landing-card-label landing-card-label-white">{t('landing.clock.filledLabel')}</p>
                    <MonthStrip today={today} mode="filled" />
                </div>
            </div>
            <p className="landing-lead landing-lead-white">{describeDaysAsCircles(today)}</p>
            <button type="button" className="landing-cta" onClick={() => { navigateTo('register', 'landing'); }}>
                {t('landing.clock.cta')}
            </button>
        </section>
    );
}
