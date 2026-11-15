import { t } from '../i18n/i18n';
import { createStore } from '../lib/store';
import { postFeedback } from './api';

interface FeedbackState {
    /** What is written in the text box. It stays while the user visits other options of the settings. */
    draft: string;
    isSending: boolean;
    /** The message under the text box, and whether it reports success. */
    message: string;
    messageIsSuccess: boolean;
    /** Whether the text box is marked as invalid. */
    isInvalid: boolean;
}

export const feedbackStore = createStore<FeedbackState>({
    draft: '',
    isSending: false,
    message: '',
    messageIsSuccess: false,
    isInvalid: false
});

/** Keep what the user writes, and clear the message about the last attempt. */
export function setFeedbackDraft(draft: string): void {
    feedbackStore.update({ draft, message: '', messageIsSuccess: false, isInvalid: false });
}

/** Clear the message about the last attempt, unless a message is still being sent. */
export function clearFeedbackMessage(): void {
    if (!feedbackStore.get().isSending) feedbackStore.update({ message: '', messageIsSuccess: false, isInvalid: false });
}

/** The result of a send attempt: whether the text box was cleared. */
export type SendOutcome = 'sent' | 'rejected' | 'empty' | 'busy';

/** Validate and send what is written. The text box is cleared when it is sent. */
export async function sendFeedback(): Promise<SendOutcome> {
    if (feedbackStore.get().isSending) return 'busy';
    const text = feedbackStore.get().draft;
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
        const result = await postFeedback(text, 'profile');
        if (!result.success) {
            feedbackStore.update({
                message: result.status === 400
                    ? t('feedback.checkMessage')
                    : t('feedback.failed')
            });
            return 'rejected';
        }
        feedbackStore.update({ draft: '', message: t('feedback.sent'), messageIsSuccess: true });
        return 'sent';
    } catch {
        feedbackStore.update({ message: t('feedback.unreachable') });
        return 'rejected';
    } finally {
        feedbackStore.update({ isSending: false });
    }
}
