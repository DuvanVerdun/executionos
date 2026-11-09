// The feedback form.

import { toggleUserMenu, userMenuState } from '../shared/user-menu.js';
import { postFeedback } from './api.js';
import { feedbackDom } from './dom.js';
import { feedbackState } from './state.js';

/** Open feedback entry and record its originating screen. */
function openFeedbackForm(currentScreen) {
    if (!feedbackState.isSending) {
        feedbackDom.message.textContent = '';
        feedbackDom.message.classList.remove('feedback-success');
        feedbackDom.input.removeAttribute('aria-invalid');
    }
    feedbackState.currentScreen = currentScreen;
    if (userMenuState.isOpened) toggleUserMenu(currentScreen);
    feedbackDom.form.style.display = 'flex';
}

/** Close feedback entry and clear its originating screen. */
export function closeFeedbackForm() {
    feedbackState.currentScreen = null;
    feedbackDom.form.style.display = 'none';
}

/** Close feedback entry when clicking outside the form and open controls. */
function closeFeedbackFormOnOutsideClick(event) {
    if (feedbackDom.form.style.display !== 'flex') return;
    const clickedInsideForm = feedbackDom.form.contains(event.target);
    const clickedOpenButton = event.target.closest('[data-feedback-screen]');
    if (clickedInsideForm || clickedOpenButton) return;
    closeFeedbackForm();
}

/** Validate and submit feedback with request-state controls. */
async function handleSubmitFeedback(event) {
    event.preventDefault();
    if (feedbackState.isSending) return;

    const feedbackInput = feedbackDom.input;
    const sendButton = feedbackDom.sendButton;
    const message = feedbackDom.message;
    message.classList.remove('feedback-success');
    feedbackInput.removeAttribute('aria-invalid');
    message.textContent = '';

    if (!feedbackInput.value.trim() || feedbackInput.value.length > 2000) {
        message.textContent = !feedbackInput.value.trim()
            ? 'Write a message before sending.'
            : 'Keep your message to 2,000 characters or fewer.';
        feedbackInput.setAttribute('aria-invalid', 'true');
        feedbackInput.focus();
        return;
    }

    feedbackState.isSending = true;
    sendButton.disabled = true;
    sendButton.textContent = 'Sending…';
    feedbackInput.readOnly = true;
    feedbackDom.form.setAttribute('aria-busy', 'true');
    try {
        const result = await postFeedback(feedbackInput.value, feedbackState.currentScreen);
        if (result.success !== true) {
            message.textContent = result.status === 400
                ? 'Check your message and try sending it again.'
                : 'Couldn’t send your feedback. Please try again.';
            return;
        }
        message.textContent = 'Feedback sent. Thank you!';
        message.classList.add('feedback-success');
        feedbackInput.value = '';
        feedbackInput.style.height = '';
    } catch (error) {
        message.textContent = 'Couldn’t reach the server. Your message is still here—try again.';
    } finally {
        feedbackState.isSending = false;
        sendButton.disabled = false;
        sendButton.textContent = 'Send Feedback';
        feedbackInput.readOnly = false;
        feedbackDom.form.removeAttribute('aria-busy');
    }
}

/** Resize feedback input to fit its content. */
function handleFeedbackInput() {
    const input = feedbackDom.input;
    input.removeAttribute('aria-invalid');
    feedbackDom.message.textContent = '';
    feedbackDom.message.classList.remove('feedback-success');
    input.style.overflowY = 'hidden';
    input.style.height = 'auto';
    const borderHeight = input.offsetHeight - input.clientHeight;
    input.style.height = `${input.scrollHeight + borderHeight}px`;
    if (input.scrollHeight > input.clientHeight + 1) {
        input.style.overflowY = 'auto';
    }
}

/** Connect the feedback form. */
export function initFeedback() {
    document.querySelectorAll('[data-feedback-screen]').forEach(/** Attach a feedback-opening handler. */ (button) => {
        button.addEventListener('click', /** Open feedback from the selected screen. */ () => {
            openFeedbackForm(button.dataset.feedbackScreen);
        });
    });
    feedbackDom.closeButton.addEventListener('click', closeFeedbackForm);
    feedbackDom.form.addEventListener('submit', handleSubmitFeedback);
    feedbackDom.input.addEventListener('input', handleFeedbackInput);
    document.addEventListener('click', closeFeedbackFormOnOutsideClick);
}
