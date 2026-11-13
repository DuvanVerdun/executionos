import { Fragment, type RefObject } from 'react';
import { useT } from '../i18n/i18n';
import { withCssVariables } from '../lib/css';
import { addDays, formatLocalDate } from '../lib/dates';
import { navigateTo } from '../shared/navigation';
import { DemoCalendarGrid } from './DemoCalendar';
import { demoRecentDays } from './demo';
import { LoginPrompt } from './LoginPrompt';

const HERO_DAYS = 14;

/** How long the mouse must stay away from the calendar before yesterday's summary shows. */
const YESTERDAY_DELAY_MS = 3000;

interface HeroSectionProps {
    today: Date;
    /** The register button. The header offers its own once the page has scrolled past this one. */
    ctaRef: RefObject<HTMLButtonElement | null>;
}

/** Draw the first section: the promise, and a calendar with a record next to one without. */
export function HeroSection({ today, ctaRef }: HeroSectionProps) {
    const t = useT();
    const days = demoRecentDays(today, HERO_DAYS);
    const workedDays = days.filter(/** Keep the days with work. */ (day) => day.state === 'work').length;
    const yesterday = formatLocalDate(addDays(today, -1));

    return (
        <section className="landing-section landing-hero" aria-labelledby="landing-hero-title">
            <div className="landing-hero-copy">
                <h1 id="landing-hero-title" className="landing-hero-title">
                    {t('landing.hero.title').split(' ').map(/** Draw one word, which comes into focus after the one before it. */ (word, index) => (
                        <Fragment key={index}>
                            <span className="landing-word" style={withCssVariables({}, { '--word': String(index) })}>{word}</span>{' '}
                        </Fragment>
                    ))}
                </h1>
                <p className="landing-lead landing-hero-subtitle">{t('landing.hero.subtitle')}</p>
                <button
                    ref={ctaRef}
                    type="button"
                    className="landing-cta landing-hero-cta"
                    onClick={() => { navigateTo('register', 'landing'); }}
                >
                    {t('landing.cta.start')}
                </button>
                <LoginPrompt />
            </div>
            <div className="landing-hero-cards">
                <div className="landing-card" aria-hidden="true">
                    <p className="landing-card-label">{t('landing.hero.withoutLabel')}</p>
                    <div className="landing-unknown-days">
                        {Array.from({ length: HERO_DAYS }, /** Draw a day nobody knows about. */ (_, index) => <span key={index}>?</span>)}
                    </div>
                    <p className="landing-card-text">{t('landing.hero.withoutText')}</p>
                </div>
                <div className="landing-card landing-card-record">
                    <p className="landing-card-label landing-card-label-white">{t('landing.hero.withLabel')}</p>
                    <DemoCalendarGrid days={days} highlightedDate={yesterday} highlightDelayMs={YESTERDAY_DELAY_MS} />
                    <p className="landing-card-strong">{t('landing.hero.workedDays', { count: workedDays })}</p>
                </div>
            </div>
        </section>
    );
}
