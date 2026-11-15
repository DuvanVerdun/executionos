import { beforeAll, describe, expect, it } from 'vitest';
import { roomSessionStore } from '../rooms/room-session-state';
import { sessionStore, updateActiveSession } from '../session/state';
import { startFaviconSync } from './favicon';

let link: HTMLLinkElement;
let idleHref: string;

beforeAll(() => {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg';
    document.head.append(link);
    idleHref = link.href;
    startFaviconSync();
});

/** Read the white part of the ring that the icon shows now, in percent. */
function whiteOfIcon(): string | undefined {
    return /stroke-dasharray%3D%22([\d.]+)%20100/.exec(link.href)?.[1];
}

/** Tell whether the icon that shows now has the pause bars. */
function hasPauseBars(): boolean {
    return link.href.includes('%3Crect');
}

describe('the icon of the tab', () => {
    it('is the whole teal ring when the user is not in a session', () => {
        expect(link.href).toBe(idleHref);
    });

    it('shows the progress of a personal session as it changes', () => {
        updateActiveSession({ startTimestamp: new Date().toISOString(), targetTimeSeconds: 100, percentageCompleted: 40, isTimerRunning: true });
        expect(whiteOfIcon()).toBe('40');
        expect(hasPauseBars()).toBe(false);
        updateActiveSession({ percentageCompleted: 60 });
        expect(whiteOfIcon()).toBe('60');
    });

    it('shows the pause icon while a personal session is paused or in Review, and takes it away when it runs again', () => {
        updateActiveSession({ startTimestamp: new Date().toISOString(), percentageCompleted: 40, isTimerRunning: false });
        expect(whiteOfIcon()).toBe('40');
        expect(hasPauseBars()).toBe(true);
        updateActiveSession({ isTimerRunning: true });
        expect(hasPauseBars()).toBe(false);
    });

    it('shows the progress of a room session, ahead of a personal one', () => {
        updateActiveSession({ startTimestamp: new Date().toISOString(), percentageCompleted: 40 });
        roomSessionStore.update({ active: true, display: { ...roomSessionStore.get().display, percentageCompleted: 25 } });
        expect(whiteOfIcon()).toBe('25');
        expect(hasPauseBars()).toBe(false);
    });

    it('shows the pause icon while a room session is paused', () => {
        roomSessionStore.update({ active: true, isPaused: true });
        expect(hasPauseBars()).toBe(true);
    });

    it('goes back to the whole teal ring when the session ends', () => {
        updateActiveSession({ startTimestamp: new Date().toISOString(), percentageCompleted: 40 });
        expect(link.href).not.toBe(idleHref);
        sessionStore.update({ active: { ...sessionStore.get().active, startTimestamp: '' } });
        expect(link.href).toBe(idleHref);
    });

    it('does not touch the icon again while the progress stays the same', () => {
        updateActiveSession({ startTimestamp: new Date().toISOString(), percentageCompleted: 40 });
        const shown = link.href;
        updateActiveSession({ actualTimeSeconds: 41 });
        expect(link.href).toBe(shown);
    });
});
