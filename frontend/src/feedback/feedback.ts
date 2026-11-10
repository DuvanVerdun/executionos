import { t } from '../i18n/i18n';
import { createStore } from '../lib/store';
import { closeUserMenu, userMenuStore } from '../shared/user-menu';
import type { HeaderScreenName } from '../types/screens';
import { postFeedback } from './api';

interface FeedbackState {
    isOpen: boolean;
    /** The screen the form was opened from. */
    currentScreen: HeaderScreenName | null;
    isSending: boolean;
    /** The message under the text box, and whether it reports success. */
    message: string;
    messageIsSuccess: boolean;
    /** Whether the text box is marked as invalid. */
    isInvalid: boolean;
}

export const feedbackStore = createStore<FeedbackState>({
    isOpen: false,
    currentScreen: null,
    isSending: false,
    message: '',
    messageIsSuccess: false,
    isInvalid: false
});

/** Open feedback entry and record its originating screen. */
export function openFeedbackForm(currentScreen: HeaderScreenName): void {
    if (!feedbackStore.get().isSending) {
        feedbackStore.update({ message: '', messageIsSuccess: false, isInvalid: false });
    }
    feedbackStore.update({ currentScreen, isOpen: true });
    if (userMenuStore.get().openScreen !== null) closeUserMenu();
}

/** Close feedback entry and clear its originating screen. */
export function closeFeedbackForm(): void {
    feedbackStore.update({ currentScreen: null, isOpen: false });
}

/** The result of a send attempt: whether the text box should be cleared. */
export type SendOutcome = 'sent' | 'rejected' | 'empty' | 'busy';

/** Validate and send feedback. Return 'sent' when the text box should be cleared. */
export async function sendFeedback(text: string): Promise<SendOutcome> {
    if (feedbackStore.get().isSending) return 'busy';
    feedbackStore.update({ messageIsSuccess: false, isInvalid: false, message: '' });

    if (!text.trim() || text.length > 2000) {
        feedbackStore.update({
            message: !text.trim()
                ? t('feedback.empty')
                : t('feedback.tooLong'),
            isInvalid: true
        });
        return 'empty';
    }

    feedbackStore.update({ isSending: true });
    try {
        const result = await postFeedback(text, feedbackStore.get().currentScreen);
        if (!result.success) {
            feedbackStore.update({
                message: result.status === 400
                    ? t('feedback.checkMessage')
                    : t('feedback.failed')
            });
            return 'rejected';
        }
        feedbackStore.update({ message: t('feedback.sent'), messageIsSuccess: true });
        return 'sent';
    } catch {
        feedbackStore.update({ message: t('feedback.unreachable') });
        return 'rejected';
    } finally {
        feedbackStore.update({ isSending: false });
    }
}
