import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { useT } from '../i18n/i18n';
import { withCssVariables } from '../lib/css';
import { navigateTo } from '../shared/navigation';

/** How many pixels of scrolling it takes for the header background to appear completely. */
const BACKGROUND_SCROLL_RANGE = 120;

/** What the header shows: how visible its background is, and whether it offers the register button. */
interface HeaderView {
    background: number;
    isRegisterShown: boolean;
}

const RESTING_VIEW: HeaderView = { background: 0, isRegisterShown: false };

interface LandingHeaderProps {
    /** The register button of the first section. The header offers its own once the page has scrolled past it. */
    heroCtaRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Draw the header of the Landing: the wordmark, and Log in.
 * Its background and shadow fade in as the page scrolls. Once the register button of the first section is behind the header, the header offers one.
 */
export function LandingHeader({ heroCtaRef }: LandingHeaderProps) {
    const t = useT();
    const headerRef = useRef<HTMLElement>(null);
    const [view, setView] = useState(RESTING_VIEW);

    const measure = useEffectEvent(() => {
        const pageButton = heroCtaRef.current;
        const header = headerRef.current;
        const isRegisterShown = pageButton !== null && header !== null
            && pageButton.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom;
        const background = Math.min(1, Math.max(0, window.scrollY / BACKGROUND_SCROLL_RANGE));
        setView(/** Keep the view that is already drawn when nothing changed. */ (current) => (
            current.background === background && current.isRegisterShown === isRegisterShown ? current : { background, isRegisterShown }
        ));
    });

    useEffect(() => {
        let frame = 0;
        /** Measure once per screen frame, however many scroll events come. */
        const schedule = (): void => {
            if (frame !== 0) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                measure();
            });
        };
        schedule();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        return () => {
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            cancelAnimationFrame(frame);
        };
    }, []);

    return (
        <header ref={headerRef} className="landing-header" style={withCssVariables({}, { '--header-background': String(view.background) })}>
            <p className="landing-wordmark">ExecutionOS</p>
            <button
                type="button"
                className={view.isRegisterShown ? 'landing-header-cta is-shown' : 'landing-header-cta'}
                inert={!view.isRegisterShown}
                onClick={() => { navigateTo('register', 'landing'); }}
            >
                {t('landing.cta.start')}
            </button>
            <button type="button" className="landing-login-btn" onClick={() => { navigateTo('login', 'landing'); }}>
                {t('landing.header.login')}
            </button>
        </header>
    );
}
