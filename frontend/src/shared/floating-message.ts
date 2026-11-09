import { createStore } from '../lib/store';

interface FloatingMessageState {
    message: string;
    saved: boolean;
    error: boolean;
    isFading: boolean;
    isHidden: boolean;
}

export const floatingMessageStore = createStore<FloatingMessageState>({
    message: '',
    saved: false,
    error: false,
    isFading: false,
    isHidden: true
});

let fadeTimeout: ReturnType<typeof setTimeout> | null = null;

let hideTimeout: ReturnType<typeof setTimeout> | null = null;

/** Show temporary floating feedback with a five-second hold and one-second fade. */
export function setFloatingMessage(
    message: string,
    { saved = false, error = false }: { saved?: boolean; error?: boolean } = {}
): void {
    clearTimeout(fadeTimeout ?? undefined);
    clearTimeout(hideTimeout ?? undefined);
    floatingMessageStore.set({ message, saved, error, isFading: false, isHidden: !message });
    if (!message) return;
    fadeTimeout = setTimeout(/** Begin fading the message after its display interval. */ () => {
        floatingMessageStore.update({ isFading: true });
        hideTimeout = setTimeout(/** Hide the message after its fade completes. */ () => {
            floatingMessageStore.update({ isHidden: true });
        }, 1000);
    }, 5000);
}
