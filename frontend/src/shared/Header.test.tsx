import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { initializeStreakState } from '../streak/streak';
import { fakeBackendByPath, requestedPaths } from '../test/network';
import type { HeaderScreenName } from '../types/screens';
import { Header } from './Header';
import { screenStore } from './navigation';

beforeEach(() => {
    initializeStreakState();
});

describe('Header navigation', () => {
    it.each([
        ['plan', 'Plan'],
        ['dashboard', 'Dashboard'],
        ['rooms', 'Focus Rooms']
    ] as const satisfies readonly (readonly [HeaderScreenName, string])[])('shows the three buttons and marks the current one on %s', (screenName, current) => {
        render(<Header screen={screenName} className="plan-header" />);
        const buttons = screen.getAllByRole('button').filter(/** Keep the navigation buttons. */ (button) => button.classList.contains('header-nav-btn'));
        expect(buttons.map(/** Read a button's text. */ (button) => button.textContent)).toEqual(['Plan', 'Dashboard', 'Focus Rooms']);
        expect(buttons.filter(/** Keep the marked buttons. */ (button) => button.getAttribute('aria-current') === 'page').map(/** Read a button's text. */ (button) => button.textContent)).toEqual([current]);
    });

    it('does nothing when the current screen button is clicked', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        screenStore.set({ screen: 'plan' });
        render(<Header screen="plan" className="plan-header" />);
        await userEvent.click(screen.getByRole('button', { name: 'Plan' }));
        expect(screenStore.get().screen).toBe('plan');
        expect(fake).not.toHaveBeenCalled();
    });

    it('goes to Plan without loading anything', async () => {
        const fake = fakeBackendByPath(() => ({ status: 200, body: { success: true } }));
        screenStore.set({ screen: 'dashboard' });
        render(<Header screen="dashboard" className="dashboard-header" />);
        await userEvent.click(screen.getByRole('button', { name: 'Plan' }));
        expect(screenStore.get().screen).toBe('plan');
        expect(fake).not.toHaveBeenCalled();
    });

    it('goes to the Dashboard and loads its data', async () => {
        const fake = fakeBackendByPath(() => ({ status: 500 }));
        screenStore.set({ screen: 'rooms' });
        render(<Header screen="rooms" className="plan-header" />);
        await userEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
        expect(screenStore.get().screen).toBe('dashboard');
        expect(requestedPaths(fake).length).toBeGreaterThan(0);
    });

    it('goes to Rooms and loads them', async () => {
        const fake = fakeBackendByPath(() => ({ status: 500 }));
        screenStore.set({ screen: 'plan' });
        render(<Header screen="plan" className="plan-header" />);
        await userEvent.click(screen.getByRole('button', { name: 'Focus Rooms' }));
        expect(screenStore.get().screen).toBe('rooms');
        expect(requestedPaths(fake).some(/** Find the rooms request. */ (path) => path.startsWith('rooms'))).toBe(true);
    });
});
