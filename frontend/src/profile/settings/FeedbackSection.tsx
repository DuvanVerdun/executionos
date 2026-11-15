import { useLayoutEffect, useRef, type SubmitEvent } from 'react';
import { clearFeedbackMessage, feedbackStore, sendFeedback, setFeedbackDraft } from '../../feedback/feedback';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../lib/store';
import { SettingsHeading } from './SettingsPanel';

/** Draw the form that sends feedback. What is written stays while the user visits other options. */
export function FeedbackSection() {
    const t = useT();
    const { draft, isSending, message, messageIsSuccess, isInvalid } = useStore(feedbackStore);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        clearFeedbackMessage();
    }, []);

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        if (draft === '') {
            textarea.style.height = '';
            return;
        }
        textarea.style.overflowY = 'hidden';
        textarea.style.height = 'auto';
        const borderHeight = textarea.offsetHeight - textarea.clientHeight;
        textarea.style.height = `${textarea.scrollHeight + borderHeight}px`;
        if (textarea.scrollHeight > textarea.clientHeight + 1) {
            textarea.style.overflowY = 'auto';
        }
    }, [draft]);

    /** Validate and send the feedback. */
    async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const outcome = await sendFeedback();
        if (outcome === 'empty') textareaRef.current?.focus();
    }

    return (
        <form className="settings-form" noValidate aria-busy={isSending ? true : undefined} onSubmit={(event) => { void handleSubmit(event); }}>
            <SettingsHeading title={t('settings.feedback')} text={t('settings.feedbackText')} />
            <div className="settings-fields">
                <div className="input-container settings-input-container">
                    <textarea
                        ref={textareaRef} name="send-feedback-input" className="input" id="feedback-input" placeholder=" " maxLength={2000}
                        aria-describedby="feedback-message" aria-invalid={isInvalid ? true : undefined} readOnly={isSending}
                        value={draft} onChange={(event) => { setFeedbackDraft(event.target.value); }}
                    ></textarea>
                    <label className="input-placeholder" htmlFor="feedback-input">{t('feedback.inputLabel')}</label>
                </div>
                <p
                    id="feedback-message" role="status" aria-live="polite"
                    className={messageIsSuccess ? 'settings-status settings-success' : 'settings-status settings-error'}
                >
                    {message}
                </p>
            </div>
            <button type="submit" className="settings-submit-btn" disabled={isSending}>
                {isSending ? t('feedback.sending') : t('feedback.send')}
            </button>
        </form>
    );
}
