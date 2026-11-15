import { ringFaviconUrl } from '../lib/favicon';
import { roomSessionStore } from '../rooms/room-session-state';
import { sessionStore } from '../session/state';

/** How far the user's session is, in percent of its target, and whether it is paused. Review counts as paused. */
interface Progress {
    percentage: number;
    isPaused: boolean;
}

/** Return the progress of the user's session, or null when they are not in a session. */
function currentProgress(): Progress | null {
    const room = roomSessionStore.get();
    if (room.active) return { percentage: room.display.percentageCompleted, isPaused: room.isPaused };
    const personal = sessionStore.get().active;
    return personal.startTimestamp === '' ? null : { percentage: personal.percentageCompleted, isPaused: !personal.isTimerRunning };
}

/** Tell whether two progresses draw the same icon. */
function isSameProgress(first: Progress | null, second: Progress | null): boolean {
    return first?.percentage === second?.percentage && first?.isPaused === second?.isPaused;
}

/** Return the link that holds the SVG icon of the tab. The PNG link beside it is for browsers that cannot draw SVG, and never changes. */
function findIconLink(): HTMLLinkElement {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
    if (!link) throw new Error('The page has no SVG link with rel="icon".');
    return link;
}

/**
 * Keep the icon of the tab in step with the user's session: a progress ring while they are in one,
 * and the whole teal ring otherwise. The percentage comes from timestamps, so a tab that runs
 * its timers late still shows the real progress at its next tick.
 */
export function startFaviconSync(): void {
    const link = findIconLink();
    const idleHref = link.href;
    let shown: Progress | null = null;

    /** Draw the icon again when the progress changed. */
    function update(): void {
        const progress = currentProgress();
        if (isSameProgress(progress, shown)) return;
        shown = progress;
        link.href = progress === null ? idleHref : ringFaviconUrl(progress.percentage, progress.isPaused);
    }

    sessionStore.subscribe(update);
    roomSessionStore.subscribe(update);
}
