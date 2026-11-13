import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentScreenName, screenStore } from '../shared/navigation';
import { LandingScreen } from './LandingScreen';

const HERO = 'Stop starting over every Monday.';
const STREAK = 'Every day you work, a circle fills.';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
    screenStore.set({ screen: 'landing' });
});

afterEach(() => {
    vi.useRealTimers();
});

/** Find a section by the title it is named after. */
function section(name: string): HTMLElement {
    return screen.getByRole('region', { name });
}

describe('the sections', () => {
    it('tells the story from the promise to the call to register', () => {
        render(<LandingScreen />);
        expect(screen.getByRole('heading', { level: 1, name: HERO })).toBeInTheDocument();
        for (const title of [
            'Sound familiar?',
            '18 days left in November.',
            'Plan it. Focus. Review it.',
            'Feeling productive is not proof.',
            STREAK,
            'Show up where people can see you.',
            'Day 1 is today. Not Monday.'
        ]) {
            expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
        }
    });

    it('says today is the real date, in the clock and in the last call', () => {
        render(<LandingScreen />);
        expect(screen.getByText('Today is Thursday, November 12')).toBeInTheDocument();
        expect(screen.getByText('Today is Thursday, November 12.')).toBeInTheDocument();
    });

    it('counts the days left in the current month', () => {
        render(<LandingScreen />);
        expect(screen.getByText('Each of the next 18 days is a circle you can still fill.')).toBeInTheDocument();
        expect(screen.getByText('18 days left in November. Start your record, or keep guessing.')).toBeInTheDocument();
    });

    it('uses the month and the days left of the day it is opened on', () => {
        vi.setSystemTime(new Date(2027, 1, 20, 9, 0));
        render(<LandingScreen />);
        expect(screen.getByRole('heading', { level: 2, name: '8 days left in February.' })).toBeInTheDocument();
        expect(screen.getByText('Today is Saturday, February 20')).toBeInTheDocument();
    });

    it('says it when there is one day left, and when today is the last day', () => {
        vi.setSystemTime(new Date(2026, 10, 29, 9, 0));
        const { unmount } = render(<LandingScreen />);
        expect(screen.getByRole('heading', { level: 2, name: '1 day left in November.' })).toBeInTheDocument();
        expect(screen.getByText('Tomorrow is a circle you can still fill.')).toBeInTheDocument();
        unmount();
        vi.setSystemTime(new Date(2026, 10, 30, 9, 0));
        render(<LandingScreen />);
        expect(screen.getByRole('heading', { level: 2, name: 'Last day of November.' })).toBeInTheDocument();
        expect(screen.getByText('Today is the last circle you can still fill.')).toBeInTheDocument();
    });

    it('answers a Monday with a Monday headline', () => {
        vi.setSystemTime(new Date(2026, 10, 9, 9, 0));
        render(<LandingScreen />);
        expect(screen.getByRole('heading', { level: 2, name: "It's Monday. Prove you meant it." })).toBeInTheDocument();
        expect(screen.queryByText('Day 1 is today. Not Monday.')).toBeNull();
    });

    it('draws the loop with the app screens, filled with a mission', () => {
        render(<LandingScreen />);
        const how = section('Plan it. Focus. Review it.');
        expect(within(how).getByDisplayValue('Learn about AI')).toBeInTheDocument();
        expect(within(how).getByDisplayValue('01:30')).toBeInTheDocument();
        expect(within(how).getAllByText('Learn about AI')).toHaveLength(2);
        expect(within(how).getByText('1:12:00')).toBeInTheDocument();
        expect(within(how).queryByText('80%')).toBeNull();
        expect(within(how).getByText('Target: 1h 30m')).toBeInTheDocument();
        expect(within(how).getByText('Completed')).toBeInTheDocument();
        expect(within(how).getByText('121%')).toBeInTheDocument();
        expect(within(how).getByText('1h 49m')).toBeInTheDocument();
    });

    it('draws the stats and the chart of the dashboard', () => {
        render(<LandingScreen />);
        const proof = section('Feeling productive is not proof.');
        for (const label of ['Focused', 'Sessions', 'Avg. Completion', 'Avg. Session Time']) {
            expect(within(proof).getAllByText(label).length).toBeGreaterThan(0);
        }
        expect(within(proof).getByRole('img', { name: 'Execution trend' })).toBeInTheDocument();
    });

    it('draws a room with people working and one paused', () => {
        render(<LandingScreen />);
        const rooms = section('Show up where people can see you.');
        expect(within(rooms).getAllByRole('img', { name: 'Working' })).toHaveLength(3);
        expect(within(rooms).getByRole('img', { name: 'Paused' })).toBeInTheDocument();
        expect(within(rooms).getByText('Fix the bug I wrote yesterday')).toBeInTheDocument();
    });

    it('shows the streak that the demo has', () => {
        render(<LandingScreen />);
        expect(within(section(STREAK)).getByText('34')).toBeInTheDocument();
        expect(within(section(STREAK)).getByText('2 rest days remaining this week.')).toBeInTheDocument();
    });
});

describe('the demos', () => {
    it('cannot be used', () => {
        const { container } = render(<LandingScreen />);
        expect(container.querySelectorAll('.landing-demo[inert]')).toHaveLength(5);
    });

    it('leave the month arrows of the calendar without a click', () => {
        render(<LandingScreen />);
        const calendar = section(STREAK);
        expect(within(calendar).getByRole('button', { name: 'Previous month' })).toBeDisabled();
        expect(within(calendar).getByRole('button', { name: 'Next month' })).toBeDisabled();
    });
});

describe('the calendar of the first section', () => {
    it('draws the last 14 days, up to today, with their real dates', () => {
        render(<LandingScreen />);
        const days = Array.from(section(HERO).querySelectorAll('.streak-calendar-day'));
        expect(days.map(/** Read the number of a day. */ (day) => day.firstChild?.textContent)).toEqual(
            ['30', '31', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
        );
        expect(days.at(-1)).toHaveClass('streak-calendar-day-today');
    });

    it('counts the days worked', () => {
        render(<LandingScreen />);
        expect(within(section(HERO)).getByText('9 days worked. Exactly.')).toBeInTheDocument();
    });

    it('shows yesterday summary after the mouse has been away for 3 seconds', () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
        render(<LandingScreen />);
        expect(within(section(HERO)).queryByRole('tooltip')).toBeNull();
        act(() => { vi.advanceTimersByTime(3000); });
        const card = within(section(HERO)).getByRole('tooltip');
        expect(card).toHaveTextContent('Wed, Nov 11');
        expect(card).toHaveTextContent('2 sessions · 1h 50m focused');
    });

    it('shows the summary of the day under the mouse at once, and brings yesterday back 3 seconds after it leaves', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
        const user = userEvent.setup({ delay: null });
        render(<LandingScreen />);
        const hero = section(HERO);
        act(() => { vi.advanceTimersByTime(3000); });
        await user.hover(within(hero).getByText('10'));
        expect(within(hero).getAllByRole('tooltip')).toHaveLength(1);
        expect(within(hero).getByRole('tooltip')).toHaveTextContent('Tue, Nov 10');
        await user.unhover(within(hero).getByText('10'));
        expect(within(hero).queryByRole('tooltip')).toBeNull();
        act(() => { vi.advanceTimersByTime(3000); });
        expect(within(hero).getByRole('tooltip')).toHaveTextContent('Wed, Nov 11');
    });

    it('says a rest day is a rest day', async () => {
        render(<LandingScreen />);
        await userEvent.hover(within(section(HERO)).getByText('7'));
        expect(within(section(HERO)).getByRole('tooltip')).toHaveTextContent('Rest day');
    });
});

describe('the streak calendar', () => {
    it('draws every day of the current month, and shows no summary at rest', () => {
        render(<LandingScreen />);
        const calendar = section(STREAK);
        expect(within(calendar).getByText('November 2026')).toBeInTheDocument();
        expect(calendar.querySelectorAll('.streak-calendar-day')).toHaveLength(30);
        expect(within(calendar).queryByRole('tooltip')).toBeNull();
    });

    it('draws today in gray, the days behind with their state, and the days ahead plain', () => {
        render(<LandingScreen />);
        const days = Array.from(section(STREAK).querySelectorAll('.streak-calendar-day'));
        expect(days.at(11)).toHaveClass('streak-calendar-day-today');
        expect(days.at(10)).toHaveClass('streak-calendar-day-work');
        expect(days.at(6)).toHaveClass('streak-calendar-day-rest');
        expect(days.at(7)).toHaveClass('streak-calendar-day-rest');
        expect(days.at(0)).toHaveClass('streak-calendar-day-neutral');
        expect(days.at(12)).toHaveClass('streak-calendar-day-neutral');
    });

    it('shows the summary of the day before yesterday while the pill is hovered', async () => {
        render(<LandingScreen />);
        const calendar = section(STREAK);
        await userEvent.hover(within(calendar).getByText('Hover a day to see its sessions'));
        const card = within(calendar).getByRole('tooltip');
        expect(card).toHaveTextContent('Tue, Nov 10');
        expect(card).toHaveTextContent('3 sessions · 2h 0m focused');
        expect(within(calendar).getByText('10')).toHaveClass('is-highlighted');
        await userEvent.unhover(within(calendar).getByText('Hover a day to see its sessions'));
        expect(within(calendar).queryByRole('tooltip')).toBeNull();
    });

    it('shows nothing for the pill when the day before yesterday is in the last month', async () => {
        vi.setSystemTime(new Date(2026, 10, 2, 12, 0));
        render(<LandingScreen />);
        const calendar = section(STREAK);
        await userEvent.hover(within(calendar).getByText('Hover a day to see its sessions'));
        expect(within(calendar).queryByRole('tooltip')).toBeNull();
    });

    it('lets the mouse on a day win over the pill', async () => {
        render(<LandingScreen />);
        const calendar = section(STREAK);
        await userEvent.hover(within(calendar).getByText('Hover a day to see its sessions'));
        await userEvent.hover(within(calendar).getByText('9'));
        expect(within(calendar).getAllByRole('tooltip')).toHaveLength(1);
        expect(within(calendar).getByRole('tooltip')).toHaveTextContent('Mon, Nov 9');
    });

    it('says what a day ahead holds', async () => {
        render(<LandingScreen />);
        await userEvent.hover(within(section(STREAK)).getByText('20'));
        expect(within(section(STREAK)).getByRole('tooltip')).toHaveTextContent('No sessions yet');
    });
});

describe('the buttons', () => {
    it('send the visitor to Register', async () => {
        render(<LandingScreen />);
        await userEvent.click(within(section(HERO)).getByRole('button', { name: 'Start your first mission' }));
        expect(getCurrentScreenName()).toBe('register');
    });

    it.each([
        'Fill your first circle',
        'Start your first mission'
    ])('send the visitor to Register from "%s" further down', async (name) => {
        render(<LandingScreen />);
        const buttons = screen.getAllByRole('button', { name });
        await userEvent.click(buttons.at(-1) ?? document.body);
        expect(getCurrentScreenName()).toBe('register');
    });

    it('send someone with an account to Login, from the header and from the links', async () => {
        const { unmount } = render(<LandingScreen />);
        await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Log in' }));
        expect(getCurrentScreenName()).toBe('login');
        unmount();
        screenStore.set({ screen: 'landing' });
        render(<LandingScreen />);
        await userEvent.click(within(section(HERO)).getByRole('button', { name: 'Log in' }));
        expect(getCurrentScreenName()).toBe('login');
    });
});

describe('the header', () => {
    const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    let pageButtonBottom = 700;

    beforeEach(() => {
        pageButtonBottom = 700;
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
            if (this.classList.contains('landing-hero-cta')) return new DOMRect(100, pageButtonBottom - 70, 400, 70);
            if (this.classList.contains('landing-header')) return new DOMRect(190, 32, 1522, 80);
            return new DOMRect(0, 0, 0, 0);
        });
    });

    afterEach(() => {
        if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
    });

    /** Scroll the page to a height, and tell the page. */
    function scrollTo(scrollY: number): void {
        Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
        window.dispatchEvent(new Event('scroll'));
    }

    it('has no background and no register button at the top', async () => {
        render(<LandingScreen />);
        const header = screen.getByRole('banner');
        await waitFor(() => { expect(header.style.getPropertyValue('--header-background')).toBe('0'); });
        expect(within(header).getByRole('button', { name: 'Start your first mission' })).toHaveAttribute('inert');
    });

    it('fades its background in as the page scrolls', async () => {
        render(<LandingScreen />);
        scrollTo(60);
        await waitFor(() => { expect(screen.getByRole('banner').style.getPropertyValue('--header-background')).toBe('0.5'); });
        scrollTo(500);
        await waitFor(() => { expect(screen.getByRole('banner').style.getPropertyValue('--header-background')).toBe('1'); });
    });

    it('offers the register button once the page has scrolled past the one of the first section, and takes it back when it scrolls up', async () => {
        render(<LandingScreen />);
        const button = within(screen.getByRole('banner')).getByRole('button', { name: 'Start your first mission' });
        pageButtonBottom = 100;
        scrollTo(400);
        await waitFor(() => { expect(button).not.toHaveAttribute('inert'); });
        expect(button).toHaveClass('is-shown');
        pageButtonBottom = 700;
        scrollTo(0);
        await waitFor(() => { expect(button).toHaveAttribute('inert'); });
        expect(button).not.toHaveClass('is-shown');
    });

    it('sends the visitor to Register from the register button of the header', async () => {
        render(<LandingScreen />);
        const button = within(screen.getByRole('banner')).getByRole('button', { name: 'Start your first mission' });
        pageButtonBottom = 100;
        scrollTo(400);
        await waitFor(() => { expect(button).not.toHaveAttribute('inert'); });
        await userEvent.click(button);
        expect(getCurrentScreenName()).toBe('register');
    });
});
