import { isHeaderScreenName, type HeaderScreenName } from '../types/screens';

const STORAGE_KEY = 'executionOS_lastScreen';

/** A place the app can return to after a reload: a header screen, or one room. */
export type LastScreen =
    | { screen: HeaderScreenName }
    | { screen: 'room'; roomId: number };

/** Remember the place that the user opened. The browser forgets it when the tab closes. */
export function saveLastScreen(userId: number, place: LastScreen): void {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, ...place }));
    } catch (error) {
        console.error('Could not remember the last screen:', error);
    }
}

/** Return the place that this user opened last, or null when there is none or it cannot be trusted. */
export function loadLastScreen(userId: number): LastScreen | null {
    try {
        const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
        if (typeof saved !== 'object' || saved === null) return null;
        if (!('userId' in saved) || saved.userId !== userId || !('screen' in saved)) return null;
        if (typeof saved.screen === 'string' && isHeaderScreenName(saved.screen)) return { screen: saved.screen };
        if (saved.screen === 'room' && 'roomId' in saved && typeof saved.roomId === 'number') {
            return { screen: 'room', roomId: saved.roomId };
        }
        return null;
    } catch (error) {
        console.error('Could not read the last screen:', error);
        return null;
    }
}

/** Forget the remembered place. */
export function clearLastScreen(): void {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Could not forget the last screen:', error);
    }
}
