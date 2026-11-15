import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLanguage } from '../i18n/i18n';
import { initializeStreakState } from '../streak/streak';
import { fakeBackendByPath, requestedPaths } from '../test/network';
import type { HeaderScreenName } from '../types/screens';
import { Header } from './Header';
import { screenStore } from './navigation';

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    initializeStreakState();
});

describe('Header navigation', () => {
    it.each([
        ['plan', 'Plan'],
        ['dashboard', 'Dashboard'],
        ['rooms', 'Rooms'],
        ['profile', '']
    ] as const satisfies readonly (readonly [HeaderScreenName, string])[])('shows the three buttons and marks the current one on %s', (screenName, current) => {
        render(<Header screen={screenName} className="plan-header" />);
        const buttons = screen.getAllByRole('button').filter(/** Keep the navigation buttons. */ (button) => button.classList.contains('header-nav-btn'));
        expect(buttons.map(/** Read a button's text. */ (button) => button.textContent)).toEqual(['Plan', 'Dashboard', 'Rooms']);
        expect(buttons.filter(/** Keep the marked buttons. */ (button) => button.getAttribute('aria-current') === 'page').map(/** Read a button's text. */ (button) => button.textContent)).toEqual(current === '' ? [] : [current]);
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
        await userEvent.click(screen.getByRole('button', { name: 'Rooms' }));
        expect(screenStore.get().screen).toBe('rooms');
        expect(requestedPaths(fake).some(/** Find the rooms request. */ (path) => path.startsWith('rooms'))).toBe(true);
    });
});

describe('the way to the profile', () => {
    it('opens the profile of the user from any screen, and loads it', async () => {
        const fake = fakeBackendByPath(() => ({ status: 500 }));
        screenStore.set({ screen: 'plan' });
        render(<Header screen="plan" className="plan-header" />);
        await userEvent.click(screen.getByRole('button', { name: 'Open profile' }));
        expect(screenStore.get().screen).toBe('profile');
        expect(requestedPaths(fake).some(/** Find the profile request. */ (path) => path.startsWith('users/'))).toBe(true);
        expect(requestedPaths(fake).some(/** Find the list request. */ (path) => path.startsWith('following'))).toBe(true);
    });

    it('opens with the keyboard too', async () => {
        fakeBackendByPath(() => ({ status: 500 }));
        screenStore.set({ screen: 'rooms' });
        render(<Header screen="rooms" className="plan-header" />);
        screen.getByRole('button', { name: 'Open profile' }).focus();
        await userEvent.keyboard('{Enter}');
        expect(screenStore.get().screen).toBe('profile');
    });

    it('is marked as the current page on the profile, and on no other screen', () => {
        const { unmount } = render(<Header screen="profile" className="plan-header" />);
        expect(screen.getByRole('button', { name: 'Open profile' })).toHaveAttribute('aria-current', 'page');
        unmount();
        render(<Header screen="plan" className="plan-header" />);
        expect(screen.getByRole('button', { name: 'Open profile' })).not.toHaveAttribute('aria-current');
    });

    it('shows the profile again when it is clicked on the profile', async () => {
        const fake = fakeBackendByPath(() => ({ status: 500 }));
        screenStore.set({ screen: 'profile' });
        render(<Header screen="profile" className="plan-header" />);
        await userEvent.click(screen.getByRole('button', { name: 'Open profile' }));
        expect(screenStore.get().screen).toBe('profile');
        expect(requestedPaths(fake).some(/** Find the profile request. */ (path) => path.startsWith('users/'))).toBe(true);
    });

    it('writes the whole header in Spanish when Spanish shows', () => {
        setLanguage('es');
        render(<Header screen="rooms" className="plan-header" />);
        expect(screen.getByRole('button', { name: 'Salas' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Abrir perfil' })).toBeInTheDocument();
    });
});
