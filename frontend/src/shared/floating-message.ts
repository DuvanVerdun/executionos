// The floating message.

import { floatingMessage } from './dom';

let saveMessageFadeTimeout: ReturnType<typeof setTimeout> | null = null;

let saveMessageHideTimeout: ReturnType<typeof setTimeout> | null = null;

/** Show temporary floating feedback with a five-second hold and one-second fade. */
export function setFloatingMessage(
    message: string,
    { saved = false, error = false }: { saved?: boolean; error?: boolean } = {}
): void {
    clearTimeout(saveMessageFadeTimeout ?? undefined);
    clearTimeout(saveMessageHideTimeout ?? undefined);
    floatingMessage.textContent = message;
    floatingMessage.classList.toggle('session-save-success', saved);
    floatingMessage.classList.toggle('session-save-error', error);
    floatingMessage.classList.remove('is-fading');
    floatingMessage.hidden = !message;
    if (!message) return;
    saveMessageFadeTimeout = setTimeout(/** Begin fading the message after its display interval. */ () => {
        floatingMessage.classList.add('is-fading');
        saveMessageHideTimeout = setTimeout(/** Hide the message after its fade completes. */ () => {
            floatingMessage.hidden = true;
        }, 1000);
    }, 5000);
}
