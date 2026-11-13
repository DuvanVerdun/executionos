import { useRef, type ReactNode } from 'react';
import { useT } from '../i18n/i18n';
import { formatDuration, formatDurationHoursMinutesSeconds } from '../lib/durations';
import { MissionCard } from '../session/MissionCard';
import { ProgressRing } from '../shared/ProgressRing';

const TARGET_SECONDS = 5400;
const FOCUS_ELAPSED_SECONDS = 4320;
const REVIEW_ELAPSED_SECONDS = 6540;
const TARGET_TIME_INPUT = '01:30';

/** Return how much of the target an amount of time is, as a whole percentage. */
function percentageOfTarget(seconds: number): number {
    return Math.round(seconds / TARGET_SECONDS * 100);
}

/** Draw the Plan card of the app, filled in. Nothing in it can be used. */
function PlanDemo() {
    const t = useT();
    const missionInputRef = useRef<HTMLInputElement>(null);
    const targetTimeInputRef = useRef<HTMLInputElement>(null);
    return (
        <div className="landing-demo landing-demo-plan" inert>
            <MissionCard
                idPrefix="plan"
                className="plan-input-section"
                mission={t('landing.how.mission')}
                targetTime={TARGET_TIME_INPUT}
                error={null}
                missionInputRef={missionInputRef}
                targetTimeInputRef={targetTimeInputRef}
                onMissionChange={() => undefined}
                onTargetTimeChange={() => undefined}
                onStart={() => undefined}
            />
        </div>
    );
}

/** Draw the Focus screen of the app in the middle of a session. Nothing in it can be used. */
function FocusDemo() {
    const t = useT();
    return (
        <div className="landing-demo landing-demo-card" inert>
            <ProgressRing
                id="landing-focus-ring"
                percentage={percentageOfTarget(FOCUS_ELAPSED_SECONDS)}
                beforeTargetColor="var(--color-white)"
                afterTargetColor="var(--color-reward)"
            >
                <div className="landing-ring-mask"></div>
                <div className="landing-focus-display">
                    <p className="landing-focus-mission">{t('landing.how.mission')}</p>
                    <p className="landing-focus-target">{formatDuration(TARGET_SECONDS)}</p>
                </div>
                <p className="landing-focus-time">{formatDuration(FOCUS_ELAPSED_SECONDS)}</p>
                <div className="landing-focus-buttons">
                    <button type="button" className="normal-button">{t('focus.pause')}</button>
                    <button type="button" className="normal-button">{t('focus.stop')}</button>
                </div>
            </ProgressRing>
        </div>
    );
}

/** Draw the Review screen of the app after the target time was passed. Nothing in it can be used. */
function ReviewDemo() {
    const t = useT();
    const percentage = percentageOfTarget(REVIEW_ELAPSED_SECONDS);
    return (
        <div className="landing-demo landing-demo-card landing-review" inert>
            <div className="landing-review-display">
                <p className="landing-review-mission">{t('landing.how.mission')}</p>
                <p>{t('review.target', { time: formatDurationHoursMinutesSeconds(TARGET_SECONDS) })}</p>
            </div>
            <div className="landing-review-summary">
                <div className="landing-review-tile">
                    <p>{t('review.completed')}</p>
                    <ProgressRing
                        id="landing-review-ring"
                        percentage={percentage}
                        beforeTargetColor="var(--color-cta)"
                        afterTargetColor="var(--color-reward)"
                    >
                        <div className="landing-review-ring-mask"></div>
                        <p className="landing-review-percentage">{`${percentage}%`}</p>
                    </ProgressRing>
                </div>
                <div className="landing-review-tile">
                    <p>{t('review.focused')}</p>
                    <p className="landing-review-time">{formatDurationHoursMinutesSeconds(REVIEW_ELAPSED_SECONDS)}</p>
                </div>
            </div>
            <div className="landing-review-buttons">
                <button type="button" className="normal-button">{t('review.continue')}</button>
                <button type="button" className="reward-button landing-review-finish">{t('review.finish')}</button>
            </div>
        </div>
    );
}

/** Draw a step: its title and what it does, above its demo. */
function Step({ title, text, children }: { title: string; text: string; children: ReactNode }) {
    return (
        <div className="landing-step">
            <h3 className="landing-step-title">{title}</h3>
            <p className="landing-step-text">{text}</p>
            {children}
        </div>
    );
}

/** Draw the section that shows the three screens of the loop, the way the app draws them. */
export function HowItWorksSection() {
    const t = useT();
    const loop = [t('nav.plan'), t('landing.loop.focus'), t('landing.loop.review'), t('nav.dashboard'), t('landing.loop.repeat')];
    return (
        <section className="landing-section landing-how" aria-labelledby="landing-how-title">
            <p className="landing-kicker">{t('landing.how.kicker')}</p>
            <h2 id="landing-how-title" className="landing-title">{t('landing.how.title')}</h2>
            <div className="landing-steps">
                <Step title={t('landing.how.planTitle')} text={t('landing.how.planText')}><PlanDemo /></Step>
                <Step title={t('landing.how.focusTitle')} text={t('landing.how.focusText')}><FocusDemo /></Step>
                <Step title={t('landing.how.reviewTitle')} text={t('landing.how.reviewText')}><ReviewDemo /></Step>
            </div>
            <ol className="landing-loop" aria-label={t('landing.how.title')}>
                {loop.map(/** Draw one stop of the loop. The last one is marked. */ (name, index) => (
                    <li key={name} className={index === loop.length - 1 ? 'is-last' : undefined}>{name}</li>
                ))}
            </ol>
        </section>
    );
}
