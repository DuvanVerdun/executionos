import { useSyncExternalStore } from 'react';

export interface Store<T> {
    /** Return the current state. Always fresh, also inside async code after an `await`. */
    get: () => T;
    /** Replace the state and tell the subscribers. */
    set: (next: T) => void;
    /** Merge a patch into the state and tell the subscribers. */
    update: (patch: Partial<T>) => void;
    /** Call the listener on every change. Return a function that stops listening. */
    subscribe: (listener: () => void) => () => void;
}

/** Create a store with an initial state. */
export function createStore<T extends object>(initial: T): Store<T> {
    let state = initial;
    const listeners = new Set<() => void>();

    /** Tell every subscriber that the state changed. */
    function notify(): void {
        listeners.forEach(/** Call one subscriber. */ (listener) => {
            listener();
        });
    }

    return {
        get: () => state,
        set: (next) => {
            if (Object.is(next, state)) return;
            state = next;
            notify();
        },
        update: (patch) => {
            state = { ...state, ...patch };
            notify();
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        }
    };
}

/** Read the whole state of a store in a component. The component renders again when it changes. */
export function useStore<T>(store: Store<T>): T {
    return useSyncExternalStore(store.subscribe, store.get);
}

/**
 * Read one part of a store's state. The selector must return something stable:
 * a number, a string, a boolean, or an object that already lives in the state.
 */
export function useStoreSelector<T, S>(store: Store<T>, select: (state: T) => S): S {
    return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
