import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';
import { getCurrentScreenName, screenStore } from '../shared/navigation';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
});

afterEach(() => {
    vi.useRealTimers();
    history.replaceState(null, '', window.location.pathname);
});

/** Open the page the way a room link does. */
function openWithRoomLink(): void {
    history.replaceState(null, '', `${window.location.pathname}#join=abc123`);
}

describe('the picture next to Login', () => {
    it('says the record is waiting, with the streak and the last 7 days', () => {
        screenStore.set({ screen: 'login' });
        const { container } = render(<LoginScreen />);
        expect(screen.getByRole('heading', { level: 2, name: 'Your record is waiting.' })).toBeInTheDocument();
        expect(screen.getByText("Today's circle is still empty.")).toBeInTheDocument();
        expect(container.querySelector('.landing-streak-count')).toHaveTextContent('8');
        const days = Array.from(container.querySelectorAll('.auth-visual .streak-calendar-day'));
        expect(days.map(/** Read the number of a day. */ (day) => day.firstChild?.textContent)).toEqual(['6', '7', '8', '9', '10', '11', '12']);
        expect(days.at(-1)).toHaveClass('streak-calendar-day-today');
    });

    it('keeps the form and the switch to Register', async () => {
        screenStore.set({ screen: 'login' });
        render(<LoginScreen />);
        expect(screen.getByLabelText('Username or Email')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Create an account' }));
        expect(getCurrentScreenName()).toBe('register');
    });
});

describe('the picture next to Register', () => {
    it('shows today, the days left of the month, and the month ready to be filled', () => {
        screenStore.set({ screen: 'register' });
        const { container } = render(<RegisterScreen />);
        expect(screen.getByText('Today is Thursday, November 12')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Day 1 starts here.' })).toBeInTheDocument();
        expect(screen.getByText('18 days left in November. Fill the first circle today.')).toBeInTheDocument();
        expect(container.querySelectorAll('.auth-visual .landing-strip-day')).toHaveLength(30);
        expect(container.querySelectorAll('.auth-visual .landing-strip-day-filled')).toHaveLength(18);
    });

    it('keeps the form and the switch to Login', async () => {
        screenStore.set({ screen: 'register' });
        render(<RegisterScreen />);
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Username')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /Log in/ }));
        expect(getCurrentScreenName()).toBe('login');
    });
});

describe('the invite card', () => {
    it('is not there without a room link', () => {
        screenStore.set({ screen: 'login' });
        render(<LoginScreen />);
        expect(screen.queryByText('A room is waiting for you.')).toBeNull();
    });

    it.each([
        ['login', LoginScreen],
        ['register', RegisterScreen]
    ] as const)('shows on %s above the form, when the visitor came with a room link', (name, Screen) => {
        openWithRoomLink();
        screenStore.set({ screen: name });
        const { container } = render(<Screen />);
        const card = screen.getByRole('note');
        expect(within(card).getByText('You were invited to focus together')).toBeInTheDocument();
        expect(within(card).getByText('A room is waiting for you.')).toBeInTheDocument();
        expect(within(card).getByText('Log in or register to join.')).toBeInTheDocument();
        const column = container.querySelector('.auth-column');
        expect(column?.firstElementChild).toBe(card);
    });
});
