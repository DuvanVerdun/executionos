import { useT } from '../i18n/i18n';
import { withCssVariables } from '../lib/css';
import { useStore } from '../lib/store';
import { Screen } from '../shared/Screen';
import { continueFromStreakCelebration, streakCelebrationStore } from './celebration';

/** One place of the number on screen, such as the tens. `previous` is the digit it rolls away from, and null when it does not change. */
interface Place {
    place: number;
    digit: string;
    previous: string | null;
}

/** The sparks that rise from the flame: how far to the side, how big, when they start, and how long they take. */
const EMBERS = [
    { sideways: -78, size: 8, delay: 1.1, duration: 2.6 },
    { sideways: -34, size: 6, delay: 1.9, duration: 2.2 },
    { sideways: 12, size: 9, delay: 1.4, duration: 2.8 },
    { sideways: 52, size: 6, delay: 2.3, duration: 2.4 },
    { sideways: 84, size: 8, delay: 1.7, duration: 2.7 }
] as const;

/** Line up the digits of both numbers from the right, and mark the places where the digit changes. */
function placesOf(from: number, to: number): Place[] {
    const before = String(from);
    const after = String(to);
    return Array.from(after, /** Describe one place of the new number. */ (digit, index) => {
        const place = after.length - 1 - index;
        const previous = before.at(-1 - place) ?? '';
        return { place, digit, previous: previous === digit ? null : previous };
    });
}

/** Draw the streak number. Each digit that changes rolls up, the units first and the next places an instant after. */
function StreakNumber({ from, to }: { from: number; to: number }) {
    return (
        <p className="streak-number" role="img" aria-label={String(to)}>
            {placesOf(from, to).map(/** Draw one place. */ ({ place, digit, previous }) => (
                <span key={place} className="streak-digit" style={withCssVariables({}, { '--place': String(place) })}>
                    {previous !== null && <span className="streak-digit-previous" aria-hidden="true">{previous}</span>}
                    <span className={previous === null ? undefined : 'streak-digit-next'} aria-hidden="true">{digit}</span>
                </span>
            ))}
        </p>
    );
}

/** Draw the flame, with sparks that rise from it. */
function Flame() {
    return (
        <div className="streak-flame" aria-hidden="true">
            <span className="streak-flame-icon">🔥</span>
            {EMBERS.map(/** Draw one spark. */ ({ sideways, size, delay, duration }) => (
                <span
                    key={sideways}
                    className="streak-ember"
                    style={withCssVariables({}, {
                        '--ember-sideways': String(sideways),
                        '--ember-size': String(size),
                        '--ember-delay': `${delay}s`,
                        '--ember-duration': `${duration}s`
                    })}
                ></span>
            ))}
        </div>
    );
}

/** Draw the screen that celebrates the first session of the day: the streak rolling to its new number beside the flame, and a promise to come back. */
export function StreakScreen() {
    const t = useT();
    const { celebration } = useStore(streakCelebrationStore);
    if (celebration === null) return null;
    const { from, to, pledge } = celebration;
    const nextDay = to + 1;

    return (
        <Screen name="streak" className="streak-screen">
            <div className="streak-celebration">
                <div className="streak-hero">
                    <StreakNumber from={from} to={to} />
                    <Flame />
                </div>
                <p className="streak-label">{to === 1 ? t('streak.celebration.dayOne') : t('streak.celebration.dayOther')}</p>
                <div className="streak-message">
                    <p>{to === 1 ? t('streak.celebration.started') : t('streak.celebration.continued')}</p>
                    <p>{t('streak.celebration.comeBack', { nextDay })}</p>
                </div>
                <button type="button" id="streak-continue-btn" className="streak-continue-btn" onClick={continueFromStreakCelebration}>
                    {pledge.say(nextDay)}
                </button>
            </div>
        </Screen>
    );
}
