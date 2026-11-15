import type { ReactNode } from 'react';
import type { ScreenName } from '../types/screens';
import { SCREEN_DISPLAY } from './navigation';

interface ScreenProps {
    name: ScreenName;
    /** The classes of the screen, besides `screen`. */
    className: string;
    /** How the screen is laid out, when it is not the way `SCREEN_DISPLAY` says for its name. */
    display?: string;
    /** True while the screen is busy saving. Screen readers hear it. */
    busy?: boolean;
    children: ReactNode;
}

/** Wrap a screen with the shared screen classes and its layout. */
export function Screen({ name, className, display = SCREEN_DISPLAY[name], busy = false, children }: ScreenProps) {
    return (
        <div className={`screen ${className}`} style={{ display }} aria-busy={busy ? true : undefined}>
            {children}
        </div>
    );
}
