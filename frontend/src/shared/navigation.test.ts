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
