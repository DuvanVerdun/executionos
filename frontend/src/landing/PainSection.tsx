import { useT, type TranslationKey } from '../i18n/i18n';

const WEEKDAY_KEYS = [
    'streak.monday', 'streak.tuesday', 'streak.wednesday', 'streak.thursday', 'streak.friday', 'streak.saturday', 'streak.sunday'
] as const satisfies readonly TranslationKey[];

/** Draw the week as empty circles, each with the first letter of its weekday. */
function EmptyWeek() {
    const t = useT();
    return (
        <div className="landing-pain-days">
            {WEEKDAY_KEYS.map(/** Draw an empty weekday. */ (key) => <span key={key}>{t(key).charAt(0)}</span>)}
        </div>
    );
}

/** Draw a week where nobody knows what happened. */
function UnknownWeek() {
    return (
        <div className="landing-pain-days landing-pain-days-unknown">
            {WEEKDAY_KEYS.map(/** Draw an unknown day. */ (key) => <span key={key}>?</span>)}
        </div>
    );
}

/** Draw a line that never goes up. */
function FlatLine() {
    return (
        <svg className="landing-pain-line" viewBox="0 0 336 40" preserveAspectRatio="none">
            <path d="M0 20 L336 20" />
            <circle cx="326" cy="20" r="6" />
        </svg>
    );
}

/** Draw the section that says what it feels like to work without a record. */
export function PainSection() {
    const t = useT();
    return (
        <section className="landing-section landing-pain" aria-labelledby="landing-pain-title">
            <p className="landing-kicker landing-kicker-pain">{t('landing.pain.kicker')}</p>
            <h2 id="landing-pain-title" className="landing-title">{t('landing.pain.title')}</h2>
            <div className="landing-pain-cards">
                <div className="landing-pain-card">
                    <p className="landing-kicker landing-kicker-pain">{t('landing.pain.restartLabel')}</p>
                    <p className="landing-pain-big">{t('landing.pain.restartBig')}</p>
                    <p className="landing-pain-text">{t('landing.pain.restartText')}</p>
                    <EmptyWeek />
                </div>
                <div className="landing-pain-card">
                    <p className="landing-kicker landing-kicker-pain">{t('landing.pain.guessLabel')}</p>
                    <p className="landing-pain-big">{t('landing.pain.guessBig')}</p>
                    <p className="landing-pain-text">{t('landing.pain.guessText')}</p>
                    <UnknownWeek />
                </div>
                <div className="landing-pain-card">
                    <p className="landing-kicker landing-kicker-pain">{t('landing.pain.ideaLabel')}</p>
                    <p className="landing-pain-big">{t('landing.pain.ideaBig')}</p>
                    <p className="landing-pain-text">{t('landing.pain.ideaText')}</p>
                    <FlatLine />
                </div>
            </div>
            <p className="landing-pain-closing">
                {t('landing.pain.closing')}<span className="landing-pain-emphasis">{t('landing.pain.closingEmphasis')}</span>
            </p>
        </section>
    );
}
