// Calls to the backend feedback route.

import { apiFetch } from '../auth/http.js';

/** Submit a feedback message from the current screen. */
export function postFeedback(feedbackMessage, currentScreen) {
    return apiFetch({ path: 'feedback', method: 'POST', body: { message: feedbackMessage }, currentScreen });
}
