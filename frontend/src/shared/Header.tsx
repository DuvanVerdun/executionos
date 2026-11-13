import { useRef } from 'react';
import { handleLogout } from '../auth/logout';
import { authStore } from '../auth/state';
import { openFeedbackForm } from '../feedback/feedback';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { languageStore, setLanguage, useT, type Language, type TranslationKey } from '../i18n/i18n';
import { useStore } from '../lib/store';
import { StreakPopup } from '../streak/StreakPopup';
import { closeStreakPopup, streakStore, toggleStreakPopup } from '../streak/streak';
import { HEADER_SCREENS, type HeaderScreenName } from '../types/screens';
import { goToHeaderScreen } from './header-navigation';
import { closeUserMenu, toggleLanguageMenu, toggleUserMenu, userMenuStore } from './user-menu';

/** The languages of the language menu, each written in its own language. */
const LANGUAGE_OPTIONS = [
    { language: 'en', name: 'English' },
    { language: 'es', name: 'Español' }
] as const satisfies readonly { language: Language; name: string }[];

const NAVIGATION_LABELS = {
    plan: 'nav.plan',
    dashboard: 'nav.dashboard',
    rooms: 'nav.rooms'
} as const satisfies Record<HeaderScreenName, TranslationKey>;

interface HeaderProps {
    screen: HeaderScreenName;
    /** The classes of the header element. */
    className: string;
}

/** Draw the header of a screen: the wordmark, the three navigation buttons, the streak and the account menu. */
export function Header({ screen, className }: HeaderProps) {
    const t = useT();
    const { openScreen: openMenuScreen, isLanguageMenuOpen } = useStore(userMenuStore);
    const { language } = useStore(languageStore);
    const { openScreen: openStreakScreen, currentStreak } = useStore(streakStore);
    const { username } = useStore(authStore);
    const iconRef = useRef<SVGSVGElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const streakButtonRef = useRef<HTMLButtonElement>(null);
    const streakPopupRef = useRef<HTMLDivElement>(null);
    const isMenuOpen = openMenuScreen === screen;
    const isStreakOpen = openStreakScreen === screen;

    useDocumentEvent('click', /** Close the account menu when a click occurs outside its controls. */ (event) => {
        if (openMenuScreen === null) return;
        const target = event.target instanceof Node ? event.target : null;
        if (menuRef.current?.contains(target) || iconRef.current?.contains(target)) return;
        closeUserMenu();
    });

    useDocumentEvent('click', /** Close the consistency calendar on outside clicks. */ (event) => {
        if (openStreakScreen === null) return;
        const clickPath = event.composedPath();
        const popup = streakPopupRef.current;
        const button = streakButtonRef.current;
        if ((popup && clickPath.includes(popup)) || (button && clickPath.includes(button))) return;
        closeStreakPopup();
    });

    return (
        <header className={className}>
            <h1 className="wordmark">ExecutionOS</h1>
            {HEADER_SCREENS.map(/** Draw a navigation button. The one of the current screen is marked. */ (target) => (
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
                ref={iconRef}
                id={`${screen}-user-icon`}
                className={isMenuOpen ? 'user-icon is-open' : 'user-icon'}
                viewBox="0 0 48 48"
                aria-label={t('header.openUserMenu')}
                onClick={() => { toggleUserMenu(screen); }}
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
            <div ref={menuRef} id={`${screen}-user-menu`} style={isMenuOpen ? { display: 'flex' } : undefined}>
                <div id={`${screen}-user-menu-information`}>
                    <p id={`${screen}-user-menu-username`}>{username}</p>
                </div>
                <button
                    type="button"
                    id={`${screen}-user-menu-feedback-btn`}
                    data-feedback-screen={screen}
                    onClick={() => { openFeedbackForm(screen); }}
                >
                    {t('header.sendFeedback')}
                </button>
                <div className="language-menu-wrapper">
                    <button
                        type="button"
                        id={`${screen}-user-menu-language-btn`}
                        aria-haspopup="menu"
                        aria-expanded={isLanguageMenuOpen}
                        onClick={toggleLanguageMenu}
                    >
                        {t('header.language')}
                    </button>
                    {isLanguageMenuOpen && (
                        <div className="language-menu" role="menu" aria-label={t('header.chooseLanguage')}>
                            {LANGUAGE_OPTIONS.map(/** Draw the button of one language. The current one is checked. */ (option) => (
                                <button
                                    key={option.language}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={option.language === language}
                                    onClick={() => { setLanguage(option.language); closeUserMenu(); }}
                                >
                                    {option.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button id={`${screen}-user-menu-logout-btn`} onClick={() => { void handleLogout(screen); }}>{t('header.logout')}</button>
            </div>
        </header>
    );
}
