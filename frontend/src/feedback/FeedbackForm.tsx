import { useLayoutEffect, useRef, useState, type SubmitEvent } from 'react';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useT } from '../i18n/i18n';
import { closestElement } from '../lib/dom';
import { useStore } from '../lib/store';
import { closeFeedbackForm, feedbackStore, sendFeedback } from './feedback';

/** Draw the feedback form. */
export function FeedbackForm() {
    const t = useT();
    const { isOpen, isSending, message, messageIsSuccess, isInvalid } = useStore(feedbackStore);
    const [text, setText] = useState('');
    const formRef = useRef<HTMLFormElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        if (text === '') {
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
    }, [text]);

    useDocumentEvent('click', /** Close feedback entry when clicking outside the form and open controls. */ (event) => {
        const target = event.target instanceof Node ? event.target : null;
        const clickedInsideForm = formRef.current?.contains(target) ?? false;
        const clickedOpenButton = closestElement(event.target, '[data-feedback-screen]', Element);
        if (clickedInsideForm || clickedOpenButton) return;
        closeFeedbackForm();
    }, isOpen);

    /** Validate and submit feedback with request-state controls. */
    async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const outcome = await sendFeedback(text);
        if (outcome === 'empty') textareaRef.current?.focus();
        if (outcome === 'sent') setText('');
    }

    return (
        <form
            ref={formRef}
            id="dashboard-feedback-form"
            style={{ display: isOpen ? 'flex' : 'none' }}
            aria-busy={isSending ? true : undefined}
            onSubmit={(event) => { void handleSubmit(event); }}
        >

            <div className="dashboard-feedback-form-header">
                <h2>{t('feedback.title')}</h2>
                <button type="button" id="dashboard-close-feedback-form-btn" aria-label={t('feedback.close')} onClick={closeFeedbackForm}>
                    <svg
                        viewBox="0 0 24 24"
                        width="24"
                        height="24"
                        aria-hidden="true"
                    >
                        <path
                            d="M18 6 6 18M6 6l12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>
            </div>

            <textarea
                ref={textareaRef}
                name="send-feedback-input"
                className="input"
                id="dashboard-feedback-input"
                maxLength={2000}
                aria-label={t('feedback.inputLabel')}
                aria-describedby="feedback-message"
                aria-invalid={isInvalid ? true : undefined}
                readOnly={isSending}
                value={text}
                onChange={(event) => {
                    setText(event.target.value);
                    feedbackStore.update({ isInvalid: false, message: '', messageIsSuccess: false });
                }}
            ></textarea>
            <p id="feedback-message" className={messageIsSuccess ? 'form-error-message feedback-success' : 'form-error-message'} role="status" aria-live="polite">
                {message}
            </p>
            <button type="submit" className="white-filled-button" id="dashboard-send-feedback-btn" disabled={isSending}>
                {isSending ? t('feedback.sending') : t('feedback.send')}
            </button>
        </form>
    );
}
