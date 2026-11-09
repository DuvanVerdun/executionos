// Elements of the feedback form.

import { getById } from '../lib/dom';

/** Elements of the feedback form. */
export const feedbackDom = {
    form: getById('dashboard-feedback-form', HTMLFormElement),
    closeButton: getById('dashboard-close-feedback-form-btn', HTMLButtonElement),
    input: getById('dashboard-feedback-input', HTMLTextAreaElement),
    message: getById('feedback-message', HTMLParagraphElement),
    sendButton: getById('dashboard-send-feedback-btn', HTMLButtonElement)
};
