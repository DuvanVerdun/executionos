import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useToday } from './useToday';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 23, 50));
});

afterEach(() => {
    vi.useRealTimers();
});

/** Tell the page that the tab is on the screen again. */
function showTabAgain(): void {
    document.dispatchEvent(new Event('visibilitychange'));
}

describe('useToday', () => {
    it('gives today', () => {
        const { result } = renderHook(() => useToday());
        expect(result.current.getDate()).toBe(12);
    });

    it('gives the new day when the tab comes back after midnight', () => {
        const { result } = renderHook(() => useToday());
        vi.setSystemTime(new Date(2026, 10, 13, 8, 0));
        act(() => { showTabAgain(); });
        expect(result.current.getDate()).toBe(13);
    });

    it('keeps the same date object while the day does not change', () => {
        const { result } = renderHook(() => useToday());
        const first = result.current;
        vi.setSystemTime(new Date(2026, 10, 12, 23, 59));
        act(() => { showTabAgain(); });
        expect(result.current).toBe(first);
    });

    it('does nothing while the tab is hidden', () => {
        const { result } = renderHook(() => useToday());
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        vi.setSystemTime(new Date(2026, 10, 13, 8, 0));
        act(() => { showTabAgain(); });
        expect(result.current.getDate()).toBe(12);
    });
});
