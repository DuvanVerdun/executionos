import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { screenStore } from './shared/navigation';
import type { ScreenName } from './types/screens';

describe('App', () => {
    it.each([
        ['loading', 'Retry'],
        ['landing', 'Sound familiar?'],
        ['register', 'Register'],
        ['login', 'Create an account'],
        ['plan', 'Start Work'],
        ['focus', 'Stop'],
        ['review', 'Continue'],
        ['dashboard', 'Stats'],
        ['rooms', 'No rooms yet'],
        ['room', 'Back to rooms']
    ] as const satisfies readonly (readonly [ScreenName, string])[])('draws the %s screen with its English texts', (name, text) => {
        screenStore.set({ screen: name });
        render(<App />);
        expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    });

    it('shows only the screen that is current', () => {
        screenStore.set({ screen: 'plan' });
        render(<App />);
        expect(screen.queryByText('Create an account')).toBeNull();
        expect(screen.queryByText('Sound familiar?')).toBeNull();
    });
});
