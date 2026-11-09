import type { ReactNode } from 'react';
import type { ScreenName } from '../types/screens';
import { SCREEN_DISPLAY } from './navigation';

interface ScreenProps {
    name: ScreenName;
    /** The classes of the screen, besides `screen`. */
    className: string;
    /** True while the screen is busy saving. Screen readers hear it. */
    busy?: boolean;
    children: ReactNode;
}

/** Wrap a screen with the shared screen classes and its layout. */
export function Screen({ name, className, busy = false, children }: ScreenProps) {
    return (
        <div className={`screen ${className}`} style={{ display: SCREEN_DISPLAY[name] }} aria-busy={busy ? true : undefined}>
            {children}
        </div>
    );
}
