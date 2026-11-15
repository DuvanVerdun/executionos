import { formatLocalDate } from '../lib/dates';
import { errorStatus } from '../lib/errors';
import { createStore } from '../lib/store';
import { navigateTo } from '../shared/navigation';
import type { ScreenName } from '../types/screens';
import { fetchStreak } from './api';
import { pickPledge, type Pledge } from './pledges';

/** A streak that grew with a session: the number before it and the number now. */
export interface StreakCelebration {
    from: number;
    to: number;
}

interface ShownCelebration extends StreakCelebration {
    /** The words on the button, picked when the screen opens so they do not change while it is shown. */
    pledge: Pledge;
    /** Takes the user on, when they give their word. */
    onContinue: () => void;
}

/** The celebration that the streak screen shows. Null when there is none. */
export const streakCelebrationStore = createStore<{ celebration: ShownCelebration | null }>({ celebration: null });

/**
 * Return the celebration for a session that was just saved, or null when it was not the first of the day.
 * The first session of the day is the one that makes today a work day, and the streak that grew with it is one day longer.
 */
export async function loadStreakCelebration(currentScreen: ScreenName): Promise<StreakCelebration | null> {
    const today = formatLocalDate(new Date());
    try {
        const result = await fetchStreak(today, currentScreen);
        if (!result.success) return null;
        const day = result.calendar.days.find(/** Find today in the calendar. */ (item) => item.date === today);
        if (day?.state !== 'work' || day.total_sessions !== 1) return null;
        return { from: result.current_streak - 1, to: result.current_streak };
    } catch (error) {
        if (errorStatus(error) !== 401) console.error('Could not load the streak after the session:', error);
        return null;
    }
}

/** Show the streak screen from the screen that saved the session. `onContinue` runs when the user leaves it. */
export function showStreakCelebration(celebration: StreakCelebration, currentScreen: ScreenName, onContinue: () => void): void {
    streakCelebrationStore.set({ celebration: { ...celebration, pledge: pickPledge(celebration.to), onContinue } });
    navigateTo('streak', currentScreen);
}

/** Leave the streak screen. */
export function continueFromStreakCelebration(): void {
    const { celebration } = streakCelebrationStore.get();
    if (celebration === null) return;
    streakCelebrationStore.set({ celebration: null });
    celebration.onContinue();
}
