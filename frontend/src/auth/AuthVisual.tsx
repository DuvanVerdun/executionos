import { useT } from '../i18n/i18n';
import { describeDaysLeft } from '../landing/copy';
import { DemoCalendarGrid } from '../landing/DemoCalendar';
import { demoCurrentStreak, demoRecentDays } from '../landing/demo';
import { MonthStrip } from '../landing/MonthStrip';
import { formatLongDate } from '../lib/dates';

const WEEK_DAYS = 7;

/** Draw what sits next to the Login card: the record that is waiting for someone who has an account. */
function LoginVisual({ today }: { today: Date }) {
    const t = useT();
    return (
        <>
            <p className="landing-kicker">{t('auth.visual.loginKicker')}</p>
            <h2 className="auth-visual-title">{t('auth.visual.loginTitle')}</h2>
            <p className="auth-visual-text">{t('auth.visual.loginText')}</p>
            <div className="landing-card auth-visual-card">
                <div className="landing-streak-chip landing-streak-chip-small" aria-hidden="true">
                    <span>🔥</span>
                    <span className="landing-streak-count">{demoCurrentStreak(today)}</span>
                    <span className="landing-streak-label">{t('landing.streak.days')}</span>
                </div>
                <DemoCalendarGrid days={demoRecentDays(today, WEEK_DAYS)} />
            </div>
        </>
    );
}

/** Draw what sits next to the Register card: the month that is waiting to be filled. */
function RegisterVisual({ today }: { today: Date }) {
    const t = useT();
    return (
        <>
            <p className="landing-kicker landing-kicker-pain">{t('landing.todayIs', { date: formatLongDate(today) })}</p>
            <h2 className="auth-visual-title">{t('auth.visual.registerTitle')}</h2>
            <p className="auth-visual-text">{`${describeDaysLeft(today)} ${t('auth.visual.registerText')}`}</p>
            <div className="landing-card auth-visual-card">
                <p className="landing-card-label landing-card-label-white">{t('landing.clock.filledLabel')}</p>
                <MonthStrip today={today} mode="filled" />
            </div>
        </>
    );
}

/** Draw the picture next to the Login or the Register card. */
export function AuthVisual({ screen, today }: { screen: 'login' | 'register'; today: Date }) {
    return (
        <div className="auth-visual">
            {screen === 'login' ? <LoginVisual today={today} /> : <RegisterVisual today={today} />}
        </div>
    );
}
