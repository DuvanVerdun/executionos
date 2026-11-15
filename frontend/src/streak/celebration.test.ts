import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentScreenName, screenStore } from '../shared/navigation';
import { fakeBackendByPath, requestedPaths, type FakeAnswer } from '../test/network';
import type { CalendarDay, CalendarState } from '../types/dashboard';
import { continueFromStreakCelebration, loadStreakCelebration, showStreakCelebration, streakCelebrationStore } from './celebration';

/** Make the answer of the streak route, with today in the calendar as given. */
function streakAnswer(currentStreak: number, state: CalendarState, totalSessions: number): FakeAnswer {
    const today = '2026-11-15';
    const days: CalendarDay[] = [
        { date: '2026-11-14', state: 'work', total_sessions: 2, total_time_seconds: 3600 },
        { date: today, state, total_sessions: totalSessions, total_time_seconds: totalSessions * 600 }
    ];
    return {
        status: 200,
        body: { success: true, current_streak: currentStreak, total_worked_days: 9, rest_days_remaining_this_week: 2, calendar: { month: '2026-11', days } }
    };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 15, 12, 0));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    vi.useRealTimers();
});

describe('loading the celebration of a saved session', () => {
    it('celebrates the first session of the day, from the streak before it to the streak now', async () => {
        fakeBackendByPath(() => streakAnswer(8, 'work', 1));
        await expect(loadStreakCelebration('review')).resolves.toEqual({ from: 7, to: 8 });
    });

    it('starts from 0 when the streak began with this session', async () => {
        fakeBackendByPath(() => streakAnswer(1, 'work', 1));
        await expect(loadStreakCelebration('review')).resolves.toEqual({ from: 0, to: 1 });
    });

    it('does not celebrate a second session of the day', async () => {
        fakeBackendByPath(() => streakAnswer(8, 'work', 2));
        await expect(loadStreakCelebration('review')).resolves.toBeNull();
    });

    it('does not celebrate while today still counts as not worked', async () => {
        fakeBackendByPath(() => streakAnswer(7, 'today', 1));
        await expect(loadStreakCelebration('review')).resolves.toBeNull();
    });

    it('asks for the calendar of today, whatever month the streak popup shows', async () => {
        const fake = fakeBackendByPath(() => streakAnswer(8, 'work', 1));
        await loadStreakCelebration('review');
        expect(requestedPaths(fake)[0]).toContain('anchor_date=2026-11-15');
    });

    it('does not celebrate when the server refuses or cannot be reached', async () => {
        fakeBackendByPath(() => ({ status: 500, body: { success: false, error: 'Could not load streak' } }));
        await expect(loadStreakCelebration('review')).resolves.toBeNull();
        fakeBackendByPath(() => new Error('offline'));
        await expect(loadStreakCelebration('review')).resolves.toBeNull();
    });
});

describe('the streak screen', () => {
    it('opens from Review with the celebration, and runs what the caller gave when the user continues', () => {
        screenStore.set({ screen: 'review' });
        const onContinue = vi.fn();
        showStreakCelebration({ from: 19, to: 20 }, 'review', onContinue);
        expect(getCurrentScreenName()).toBe('streak');
        expect(streakCelebrationStore.get().celebration).toMatchObject({ from: 19, to: 20 });
        continueFromStreakCelebration();
        expect(onContinue).toHaveBeenCalledOnce();
        expect(streakCelebrationStore.get().celebration).toBeNull();
    });

    it('picks the words of the button when it opens, from the pledges that fit the streak', () => {
        screenStore.set({ screen: 'review' });
        vi.spyOn(Math, 'random').mockReturnValue(0);
        showStreakCelebration({ from: 20, to: 21 }, 'review', vi.fn());
        expect(streakCelebrationStore.get().celebration?.pledge.say(22)).toBe('Day 22 is mine!');
    });

    it('continues only once, however many times the button is pressed', () => {
        screenStore.set({ screen: 'review' });
        const onContinue = vi.fn();
        showStreakCelebration({ from: 0, to: 1 }, 'review', onContinue);
        continueFromStreakCelebration();
        continueFromStreakCelebration();
        expect(onContinue).toHaveBeenCalledOnce();
    });

    it('does nothing when there is no celebration', () => {
        expect(() => { continueFromStreakCelebration(); }).not.toThrow();
    });
});
