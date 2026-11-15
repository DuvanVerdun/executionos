import { useRef, type KeyboardEvent } from 'react';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useT, type TranslationKey } from '../i18n/i18n';
import { useStore } from '../lib/store';
import { StreakPopup } from '../streak/StreakPopup';
import { closeStreakPopup, streakStore, toggleStreakPopup } from '../streak/streak';
import { NAVIGATION_SCREENS, type HeaderScreenName, type NavigationScreenName } from '../types/screens';
import { goToHeaderScreen } from './header-navigation';

const NAVIGATION_LABELS = {
    plan: 'nav.plan',
    dashboard: 'nav.dashboard',
    rooms: 'nav.rooms'
} as const satisfies Record<NavigationScreenName, TranslationKey>;

interface HeaderProps {
    screen: HeaderScreenName;
    /** The classes of the header element. */
    className: string;
}

/** Draw the header of a screen: the wordmark, the three navigation buttons, the streak and the way to the Profile. */
export function Header({ screen, className }: HeaderProps) {
    const t = useT();
    const { openScreen: openStreakScreen, currentStreak } = useStore(streakStore);
    const streakButtonRef = useRef<HTMLButtonElement>(null);
    const streakPopupRef = useRef<HTMLDivElement>(null);
    const isStreakOpen = openStreakScreen === screen;

    useDocumentEvent('click', /** Close the consistency calendar on outside clicks. */ (event) => {
        if (openStreakScreen === null) return;
        const clickPath = event.composedPath();
        const popup = streakPopupRef.current;
        const button = streakButtonRef.current;
        if ((popup && clickPath.includes(popup)) || (button && clickPath.includes(button))) return;
        closeStreakPopup();
    });

    /** Open the user's own profile with Enter or Space, like a button. */
    function handleIconKeyDown(event: KeyboardEvent<SVGSVGElement>): void {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        void goToHeaderScreen('profile', screen);
    }

    return (
        <header className={className}>
            <h1 className="wordmark">ExecutionOS</h1>
            {NAVIGATION_SCREENS.map(/** Draw a navigation button. The one of the current screen is marked. */ (target) => (
                <button
                    key={target}
                    type="button"
                    className="header-nav-btn"
                    aria-current={target === screen ? 'page' : undefined}
                    onClick={() => { void goToHeaderScreen(target, screen); }}
                >
                    {t(NAVIGATION_LABELS[target])}
                </button>
            ))}
            <div className="streak-container">
                <button
                    ref={streakButtonRef}
                    type="button"
                    id={`${screen}-streak-btn`}
                    className="streak-btn"
                    aria-label={t('header.openStreak')}
                    aria-expanded={isStreakOpen}
                    onClick={() => { toggleStreakPopup(screen); }}
                >
                    {`🔥 ${currentStreak ?? '—'}`}
                </button>

                <div
                    ref={streakPopupRef}
                    id={`${screen}-streak-popup`}
                    className="streak-popup"
                    style={{ display: isStreakOpen ? 'block' : 'none' }}
                >
                    <StreakPopup screen={screen} />
                </div>
            </div>
            <svg
                id={`${screen}-user-icon`}
                className={screen === 'profile' ? 'user-icon is-current' : 'user-icon'}
                viewBox="0 0 48 48"
                role="button"
                tabIndex={0}
                aria-label={t('header.openProfile')}
                aria-current={screen === 'profile' ? 'page' : undefined}
                onClick={() => { void goToHeaderScreen('profile', screen); }}
                onKeyDown={handleIconKeyDown}
            >
                <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2.5" />

                <circle cx="24" cy="17" r="7" fill="currentColor" />

                <path
                    d="M9.5 38
                    C11.5 29.5 17 25.5 24 25.5
                    C31 25.5 36.5 29.5 38.5 38
                    C34.7 42.3 29.7 44.5 24 44.5
                    C18.3 44.5 13.3 42.3 9.5 38Z"
                    fill="currentColor"
                />
            </svg>
        </header>
    );
}
