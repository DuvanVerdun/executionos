import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CalendarDay, CalendarState } from '../types/dashboard';
import { StreakPopup } from './StreakPopup';
import { streakStore } from './streak';

/** Make a day of November 2026. */
function day(dayNumber: number, state: CalendarState, totalSessions = 0, totalTimeSeconds = 0): CalendarDay {
    return { date: `2026-11-${String(dayNumber).padStart(2, '0')}`, state, total_sessions: totalSessions, total_time_seconds: totalTimeSeconds };
}

/** Show a ready calendar of November 2026 with the given days, open on the plan screen. */
function showCalendar(days: CalendarDay[], totalWorkedDays: number | null = 12): void {
    streakStore.update({
        view: 'ready', calendar: { month: '2026-11', days }, restDaysRemaining: 1, currentStreak: 3, totalWorkedDays, openScreen: 'plan'
    });
}

/** Find the circle of a day by its number. */
function circle(dayNumber: number): HTMLElement {
    return within(document.querySelector<HTMLElement>('.streak-calendar') ?? document.body).getByText(String(dayNumber));
}

const SAMPLE = [day(1, 'neutral'), day(2, 'work', 2, 5400), day(3, 'rest'), day(4, 'today'), day(5, 'neutral'), day(6, 'work', 1, 600)];

describe('the calendar days', () => {
    it('draws work, rest, today and neutral days with their own style', () => {
        showCalendar(SAMPLE);
        render(<StreakPopup screen="plan" />);
        expect(circle(2)).toHaveClass('streak-calendar-day-work');
        expect(circle(3)).toHaveClass('streak-calendar-day-rest');
        expect(circle(4)).toHaveClass('streak-calendar-day-today');
        expect(circle(5)).toHaveClass('streak-calendar-day-neutral');
    });

    it('draws a missed day like a neutral one', () => {
        showCalendar([day(1, 'missed'), day(2, 'neutral')]);
        render(<StreakPopup screen="plan" />);
        expect(circle(1)).toHaveClass('streak-calendar-day-neutral');
    });
});

describe('the legend and the total of days worked', () => {
    it('explains Work, Rest and Today', () => {
        showCalendar(SAMPLE);
        render(<StreakPopup screen="plan" />);
        const legend = document.querySelector<HTMLElement>('.streak-calendar-legend');
        expect(legend).toHaveTextContent('Work');
        expect(legend).toHaveTextContent('Rest');
        expect(legend).toHaveTextContent('Today');
    });

    it('shows the days worked ever in a card on the same row as the legend', () => {
        showCalendar(SAMPLE, 278);
        render(<StreakPopup screen="plan" />);
        const footer = document.querySelector<HTMLElement>('.streak-calendar-footer');
        expect(footer).toContainElement(document.querySelector<HTMLElement>('.streak-calendar-legend'));
        expect(footer).toContainElement(document.querySelector<HTMLElement>('.streak-calendar-total'));
        expect(document.querySelector('.streak-calendar-total')).toHaveTextContent('278Total days worked');
    });

    it('shows a dash until the total is known', () => {
        showCalendar(SAMPLE, null);
        render(<StreakPopup screen="plan" />);
        expect(document.querySelector('.streak-calendar-total-value')).toHaveTextContent('—');
    });

    it('shows the rest days left under the row', () => {
        showCalendar(SAMPLE);
        render(<StreakPopup screen="plan" />);
        expect(screen.getByText('1 rest day remaining this week.')).toBeInTheDocument();
    });
});

describe('the summary card of a day', () => {
    it('shows the sessions and the time of the day under the mouse', async () => {
        showCalendar(SAMPLE);
        render(<StreakPopup screen="plan" />);
        await userEvent.hover(circle(2));
        const card = screen.getByRole('tooltip');
        expect(card).toHaveTextContent('2 sessions');
        expect(card).toHaveTextContent('1h 30m focused');
    });

    it('says "1 session" for a single session', async () => {
        showCalendar(SAMPLE);
        render(<StreakPopup screen="plan" />);
        await userEvent.hover(circle(6));
        expect(screen.getByRole('tooltip')).toHaveTextContent('1 session');
        expect(screen.getByRole('tooltip')).not.toHaveTextContent('1 sessions');
    });

    it('says "No sessions" for a day without any', async () => {
        showCalendar(SAMPLE);
        render(<StreakPopup screen="plan" />);
        await userEvent.hover(circle(5));
        expect(screen.getByRole('tooltip')).toHaveTextContent('No sessions');
    });

    it('goes away when the mouse leaves the day', async () => {
        showCalendar(SAMPLE);
        render(<StreakPopup screen="plan" />);
        await userEvent.hover(circle(2));
        await userEvent.unhover(circle(2));
        expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('follows the mouse from one day to the next', async () => {
        showCalendar(SAMPLE);
        render(<StreakPopup screen="plan" />);
        await userEvent.hover(circle(2));
        await userEvent.hover(circle(6));
        expect(screen.getAllByRole('tooltip')).toHaveLength(1);
        expect(screen.getByRole('tooltip')).toHaveTextContent('1 session');
    });

    it('is drawn in the page body, outside the popup that clips it', async () => {
        showCalendar(SAMPLE);
        const { container } = render(<StreakPopup screen="plan" />);
        await userEvent.hover(circle(2));
        expect(container).not.toContainElement(screen.getByRole('tooltip'));
        expect(document.body).toContainElement(screen.getByRole('tooltip'));
    });

    it('does not show while the calendar is loading', async () => {
        showCalendar(SAMPLE);
        streakStore.update({ view: 'loading' });
        render(<StreakPopup screen="plan" />);
        await userEvent.hover(circle(2));
        expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('does not show when the popup of this screen is closed', async () => {
        showCalendar(SAMPLE);
        streakStore.update({ openScreen: 'dashboard' });
        render(<StreakPopup screen="plan" />);
        await userEvent.hover(circle(2));
        expect(screen.queryByRole('tooltip')).toBeNull();
    });
});
