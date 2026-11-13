import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { languageStore, setLanguage } from '../i18n/i18n';
import { initializeStreakState } from '../streak/streak';
import { fakeBackendByPath, requestedPaths } from '../test/network';
import type { HeaderScreenName } from '../types/screens';
import { Header } from './Header';
import { screenStore } from './navigation';
import { userMenuStore } from './user-menu';

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    initializeStreakState();
});

describe('Header navigation', () => {
    it.each([
        ['plan', 'Plan'],
        ['dashboard', 'Dashboard'],
        ['rooms', 'Rooms']
    ] as const satisfies readonly (readonly [HeaderScreenName, string])[])('shows the three buttons and marks the current one on %s', (screenName, current) => {
        render(<Header screen={screenName} className="plan-header" />);
        const buttons = screen.getAllByRole('button').filter(/** Keep the navigation buttons. */ (button) => button.classList.contains('header-nav-btn'));
        expect(buttons.map(/** Read a button's text. */ (button) => button.textContent)).toEqual(['Plan', 'Dashboard', 'Rooms']);
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
        await userEvent.click(screen.getByRole('button', { name: 'Rooms' }));
        expect(screenStore.get().screen).toBe('rooms');
        expect(requestedPaths(fake).some(/** Find the rooms request. */ (path) => path.startsWith('rooms'))).toBe(true);
    });
});

describe('the language menu', () => {
    /** Open the account menu, and then the language menu. */
    async function openLanguageMenu(): Promise<void> {
        await userEvent.click(screen.getByLabelText('Open user menu'));
        await userEvent.click(screen.getByRole('button', { name: 'Language' }));
    }

    it('opens beside the account menu, with English and Español, and marks the language that shows', async () => {
        render(<Header screen="plan" className="plan-header" />);
        await openLanguageMenu();
        expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('menuitemradio', { name: 'Español' })).toHaveAttribute('aria-checked', 'false');
    });

    it('is closed until the Language button is clicked, and closes when it is clicked again', async () => {
        render(<Header screen="plan" className="plan-header" />);
        await userEvent.click(screen.getByLabelText('Open user menu'));
        expect(screen.queryByRole('menu', { name: 'Choose a language' })).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: 'Language' }));
        expect(screen.getByRole('menu', { name: 'Choose a language' })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Language' }));
        expect(screen.queryByRole('menu', { name: 'Choose a language' })).toBeNull();
    });

    it('changes the language of the app when one is chosen, remembers it, and closes both menus', async () => {
        render(<Header screen="plan" className="plan-header" />);
        await openLanguageMenu();
        await userEvent.click(screen.getByRole('menuitemradio', { name: 'Español' }));
        expect(languageStore.get().language).toBe('es');
        expect(localStorage.getItem('executionOS_language')).toBe('es');
        expect(screen.getByRole('button', { name: 'Panel' })).toBeInTheDocument();
        expect(userMenuStore.get()).toEqual({ openScreen: null, isLanguageMenuOpen: false });
    });

    it('writes the whole header in Spanish when Spanish shows', () => {
        setLanguage('es');
        render(<Header screen="rooms" className="plan-header" />);
        expect(screen.getByRole('button', { name: 'Salas' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Idioma' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    });

    it('closes the language menu when the account menu closes', async () => {
        render(<Header screen="plan" className="plan-header" />);
        await openLanguageMenu();
        await userEvent.click(screen.getByLabelText('Open user menu'));
        expect(userMenuStore.get().isLanguageMenuOpen).toBe(false);
    });
});
