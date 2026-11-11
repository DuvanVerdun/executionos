import { createStore } from '../lib/store';

/** A question that waits for the user's answer. */
interface ConfirmRequest {
    message: string;
    /** The text of the button that says yes. */
    confirmLabel: string;
    resolve: (confirmed: boolean) => void;
}

/** The question that the confirm modal shows now. Null when there is none. */
export const confirmStore = createStore<{ request: ConfirmRequest | null }>({ request: null });

/** Show the confirm modal and wait. Return true when the user confirms, and false when the user cancels. */
export function confirmAction(question: { message: string; confirmLabel: string }): Promise<boolean> {
    answerConfirm(false);
    return new Promise<boolean>(/** Keep the way to answer until the user decides. */ (resolve) => {
        confirmStore.set({ request: { ...question, resolve } });
    });
}

/** Close the confirm modal and give the user's answer to the code that asked. */
export function answerConfirm(confirmed: boolean): void {
    const { request } = confirmStore.get();
    if (request === null) return;
    confirmStore.set({ request: null });
    request.resolve(confirmed);
}
