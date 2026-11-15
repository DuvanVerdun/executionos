import { useLayoutEffect, useRef, useState, type SubmitEvent } from 'react';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useT } from '../i18n/i18n';
import { useStore } from '../lib/store';
import { ModalHeader } from '../shared/ModalHeader';
import { ModalOverlay } from '../shared/ModalOverlay';
import { closeFeedbackForm, feedbackStore, sendFeedback } from './feedback';

/** Draw the feedback form. It stays mounted while closed, so the text that was not sent is kept. */
export function FeedbackForm() {
    const t = useT();
    const { isOpen, isSending, message, messageIsSuccess, isInvalid } = useStore(feedbackStore);
    const [text, setText] = useState('');
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
    }, [text, isOpen]);

    useDocumentEvent('keydown', /** Close the form with Escape. */ (event) => {
        if (event.key === 'Escape') closeFeedbackForm();
    }, isOpen);

    /** Validate and submit feedback with request-state controls. */
    async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        const outcome = await sendFeedback(text);
        if (outcome === 'empty') textareaRef.current?.focus();
        if (outcome === 'sent') setText('');
    }

    if (!isOpen) return null;

    return (
        <ModalOverlay id="feedback-overlay" canClose onClose={closeFeedbackForm} initialFocusRef={textareaRef}>
            <form
                id="feedback-form" className="modal-card" role="dialog" aria-modal="true" aria-labelledby="feedback-title" noValidate
                aria-busy={isSending ? true : undefined}
                onSubmit={(event) => { void handleSubmit(event); }}
            >
                <ModalHeader id="feedback" title={t('feedback.title')} closeLabel={t('feedback.close')} onClose={closeFeedbackForm} />
                <div className="modal-field">
                    <div className="input-container">
                        <textarea
                            ref={textareaRef}
                            name="send-feedback-input"
                            className="input"
                            id="feedback-input"
                            placeholder=" "
                            maxLength={2000}
                            aria-describedby="feedback-message"
                            aria-invalid={isInvalid ? true : undefined}
                            readOnly={isSending}
                            value={text}
                            onChange={(event) => {
                                setText(event.target.value);
                                feedbackStore.update({ isInvalid: false, message: '', messageIsSuccess: false });
                            }}
                        ></textarea>
                        <label className="input-placeholder" htmlFor="feedback-input">{t('feedback.inputLabel')}</label>
                    </div>
                    <p
                        id="feedback-message"
                        className={messageIsSuccess ? 'form-error-message modal-field-error is-success' : 'form-error-message modal-field-error'}
                        role="status"
                        aria-live="polite"
                    >
                        {message}
                    </p>
                </div>
                <button type="submit" id="feedback-submit-btn" className="modal-submit-btn" disabled={isSending}>
                    {isSending ? t('feedback.sending') : t('feedback.send')}
                </button>
            </form>
        </ModalOverlay>
    );
}
