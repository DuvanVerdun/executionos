import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createStore, useStore, useStoreSelector } from './store';

describe('createStore', () => {
    it('returns the initial state', () => {
        expect(createStore({ count: 1 }).get()).toEqual({ count: 1 });
    });

    it('merges a patch with update, and makes a new object', () => {
        const store = createStore({ a: 1, b: 2 });
        const before = store.get();
        store.update({ b: 3 });
        expect(store.get()).toEqual({ a: 1, b: 3 });
        expect(store.get()).not.toBe(before);
    });

    it('replaces the state with set', () => {
        const store = createStore({ a: 1, b: 2 });
        store.set({ a: 9, b: 9 });
        expect(store.get()).toEqual({ a: 9, b: 9 });
    });

    it('tells subscribers about every change, and stops after unsubscribe', () => {
        const store = createStore({ count: 0 });
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        store.update({ count: 1 });
        store.update({ count: 2 });
        unsubscribe();
        store.update({ count: 3 });
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('does not tell subscribers when set gets the same object', () => {
        const store = createStore({ count: 0 });
        const listener = vi.fn();
        store.subscribe(listener);
        store.set(store.get());
        expect(listener).not.toHaveBeenCalled();
    });
});

describe('useStore', () => {
    it('renders again when the store changes', () => {
        const store = createStore({ count: 0 });
        const { result } = renderHook(() => useStore(store));
        expect(result.current.count).toBe(0);
        act(() => { store.update({ count: 5 }); });
        expect(result.current.count).toBe(5);
    });

    it('renders again only when the selected part changes', () => {
        const store = createStore({ count: 0, other: 'a' });
        let renders = 0;
        const { result } = renderHook(() => {
            renders += 1;
            return useStoreSelector(store, /** Pick the count. */ (state) => state.count);
        });
        const before = renders;
        act(() => { store.update({ other: 'b' }); });
        expect(renders).toBe(before);
        act(() => { store.update({ count: 2 }); });
        expect(result.current).toBe(2);
    });
});
