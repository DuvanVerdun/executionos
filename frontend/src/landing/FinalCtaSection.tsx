import { useT } from '../i18n/i18n';
import { formatLongDate } from '../lib/dates';
import { navigateTo } from '../shared/navigation';
import { describeDaysLeft } from './copy';
import { LoginPrompt } from './LoginPrompt';

const MONDAY = 1;

/** Draw the last section: the call to register, with today's date. On a Monday it says so. */
export function FinalCtaSection({ today }: { today: Date }) {
    const t = useT();
    return (
        <section className="landing-section landing-final" aria-labelledby="landing-final-title">
            <div className="landing-final-panel">
                <p className="landing-final-date">{t('landing.final.today', { date: formatLongDate(today) })}</p>
                <h2 id="landing-final-title" className="landing-final-title">
                    {today.getDay() === MONDAY ? t('landing.final.titleMonday') : t('landing.final.title')}
                </h2>
                <p className="landing-final-text">{`${describeDaysLeft(today)} ${t('landing.final.text')}`}</p>
                <button type="button" className="landing-cta landing-final-cta" onClick={() => { navigateTo('register', 'landing'); }}>
                    {t('landing.cta.start')}
                </button>
                <p className="landing-final-note">{t('landing.final.note')}</p>
                <LoginPrompt />
            </div>
        </section>
    );
}
