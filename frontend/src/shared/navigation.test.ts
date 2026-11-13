import { describe, expect, it, vi } from 'vitest';
import { addBeforeSwitchHook, getCurrentScreenName, navigateTo, screenStore } from './navigation';

describe('navigateTo', () => {
    it('moves between screens the app allows', () => {
        screenStore.set({ screen: 'login' });
        navigateTo('plan', 'login');
        expect(getCurrentScreenName()).toBe('plan');
        navigateTo('focus', 'plan');
        expect(getCurrentScreenName()).toBe('focus');
    });

    it.each([
        ['review', 'plan'],
        ['focus', 'dashboard'],
        ['room', 'plan'],
        ['plan', 'review']
    ] as const)('refuses to go to %s from %s', (next, current) => {
        screenStore.set({ screen: current });
        navigateTo(next, current);
        expect(getCurrentScreenName()).toBe(current);
    });

    it.each(['loading', 'register', 'login'] as const)('opens the Dashboard from %s, for a user who returns after a reload', (current) => {
        screenStore.set({ screen: current });
        navigateTo('dashboard', current);
        expect(getCurrentScreenName()).toBe('dashboard');
    });

    it.each(['loading', 'login', 'register', 'plan', 'dashboard', 'rooms'] as const)('opens the Landing from %s', (current) => {
        screenStore.set({ screen: current });
        navigateTo('landing', current);
        expect(getCurrentScreenName()).toBe('landing');
    });

    it.each(['focus', 'review', 'room'] as const)('refuses to open the Landing from %s', (current) => {
        screenStore.set({ screen: current });
        navigateTo('landing', current);
        expect(getCurrentScreenName()).toBe(current);
    });

    it.each(['register', 'login'] as const)('goes from the Landing to %s', (next) => {
        screenStore.set({ screen: 'landing' });
        navigateTo(next, 'landing');
        expect(getCurrentScreenName()).toBe(next);
    });

    it.each(['plan', 'focus', 'dashboard'] as const)('refuses to go from the Landing to %s', (next) => {
        screenStore.set({ screen: 'landing' });
        navigateTo(next, 'landing');
        expect(getCurrentScreenName()).toBe('landing');
    });

    it('runs the steps added by features before the screen changes, in order', () => {
        const calls: string[] = [];
        addBeforeSwitchHook(/** Record the first step. */ (next, current) => {
            calls.push(`first ${current}>${next} while on ${getCurrentScreenName()}`);
        });
        addBeforeSwitchHook(/** Record the second step. */ () => {
            calls.push('second');
        });
        screenStore.set({ screen: 'plan' });
        navigateTo('dashboard', 'plan');
        expect(calls).toEqual(['first plan>dashboard while on plan', 'second']);
        expect(getCurrentScreenName()).toBe('dashboard');
    });

    it('does not run the steps for a move it refuses', () => {
        const hook = vi.fn();
        addBeforeSwitchHook(hook);
        screenStore.set({ screen: 'plan' });
        navigateTo('review', 'plan');
        expect(hook).not.toHaveBeenCalled();
    });
});
