import { formatLocalDate, parseLocalDate, shiftMonthAnchor } from '../lib/dates';
import { createStore } from '../lib/store';
import type { StreakData } from '../types/dashboard';
import type { HeaderScreenName, ScreenName } from '../types/screens';
import { fetchStreak } from './api';

/** What the streak popups show: nothing yet, a loading placeholder, the calendar, or an error. */
export type StreakView = 'idle' | 'loading' | 'ready' | 'failed';

interface StreakState {
    /** The first day of the month on show, as YYYY-MM-DD. */
    anchorDate: string;
    view: StreakView;
    calendar: StreakData['calendar'];
    restDaysRemaining: number;
    /** The current streak in days. Null until the first calendar loads. */
    currentStreak: number | null;
    /** The days with work, ever. Null until the first calendar loads. */
    totalWorkedDays: number | null;
    /** The header screen whose calendar popup is open. */
    openScreen: HeaderScreenName | null;
}

export const streakStore = createStore<StreakState>({
    anchorDate: '',
    view: 'idle',
    calendar: { month: '', days: [] },
    restDaysRemaining: 0,
    currentStreak: null,
    totalWorkedDays: null,
    openScreen: null
});

/** Grows with every load, so older results can be ignored. */
let loadGeneration = 0;

/** Reset streak data and calendar navigation state. */
export function initializeStreakState(): void {
    if (!streakStore.get().anchorDate) {
        streakStore.update({ anchorDate: formatLocalDate(new Date()) });
    }
}

/** Create a neutral placeholder calendar for the month of an anchor date. */
function createPlaceholderCalendar(anchorDate: string): StreakData['calendar'] {
    const month = parseLocalDate(anchorDate);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return {
        month: anchorDate.slice(0, 7),
        days: Array.from({ length: daysInMonth }, /** Create a neutral placeholder for each calendar day. */ (_, index) => ({
            date: `${anchorDate.slice(0, 7)}-${String(index + 1).padStart(2, '0')}`,
            state: 'neutral',
            total_sessions: 0,
            total_time_seconds: 0
        }))
    };
}

/** Fetch and show streak information for the current calendar selection. */
export async function loadStreak(currentScreen: ScreenName): Promise<void> {
    const generation = ++loadGeneration;
    const anchorDate = streakStore.get().anchorDate;
    const placeholder = createPlaceholderCalendar(anchorDate);
    streakStore.update({ view: 'loading', calendar: placeholder });
    try {
        const result = await fetchStreak(
            anchorDate,
            currentScreen
        );
        if (generation !== loadGeneration) return;

        if (!result.success) {
            throw new Error(result.error);
        }

        streakStore.update({
            view: 'ready',
            calendar: result.calendar,
            restDaysRemaining: result.rest_days_remaining_this_week,
            currentStreak: result.current_streak,
            totalWorkedDays: result.total_worked_days
        });

    } catch (error) {
        if (generation !== loadGeneration) return;
        console.error('Streak loading error:', error);
        streakStore.update({ view: 'failed', calendar: placeholder });
    }
}

/** Show the previous or next calendar month. */
export function shiftStreakMonth(direction: number, screen: HeaderScreenName): void {
    streakStore.update({ anchorDate: shiftMonthAnchor(streakStore.get().anchorDate, direction) });
    void loadStreak(screen);
}

/** Toggle the selected screen's consistency calendar. */
export function toggleStreakPopup(screen: HeaderScreenName): void {
    streakStore.update({ openScreen: streakStore.get().openScreen === screen ? null : screen });
}

/** Close the consistency calendar. */
export function closeStreakPopup(): void {
    streakStore.update({ openScreen: null });
}
