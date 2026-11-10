import { describe, expect, it, vi } from 'vitest';
import { clearLastScreen, loadLastScreen, saveLastScreen } from './last-screen';

describe('the last screen', () => {
    it('is empty when nothing was saved', () => {
        expect(loadLastScreen(1)).toBeNull();
    });

    it.each([
        { screen: 'plan' },
        { screen: 'dashboard' },
        { screen: 'rooms' },
        { screen: 'room', roomId: 7 }
    ] as const)('comes back as it was saved: %j', (place) => {
        saveLastScreen(1, place);
        expect(loadLastScreen(1)).toEqual(place);
    });

    it('keeps only the latest place', () => {
        saveLastScreen(1, { screen: 'dashboard' });
        saveLastScreen(1, { screen: 'rooms' });
        expect(loadLastScreen(1)).toEqual({ screen: 'rooms' });
    });

    it('is not given to another account', () => {
        saveLastScreen(1, { screen: 'dashboard' });
        expect(loadLastScreen(2)).toBeNull();
    });

    it('is forgotten when cleared', () => {
        saveLastScreen(1, { screen: 'dashboard' });
        clearLastScreen();
        expect(loadLastScreen(1)).toBeNull();
    });

    it.each([
        ['text that is not JSON', 'not json'],
        ['a screen that does not exist', '{"userId":1,"screen":"focus"}'],
        ['a room without an ID', '{"userId":1,"screen":"room"}'],
        ['a room with a text ID', '{"userId":1,"screen":"room","roomId":"7"}'],
        ['a value that is not an object', '5']
    ])('is ignored when the saved value is %s', (_description, saved) => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        sessionStorage.setItem('executionOS_lastScreen', saved);
        expect(loadLastScreen(1)).toBeNull();
    });
});
