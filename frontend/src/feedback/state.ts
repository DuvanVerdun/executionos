// Feedback form state.

import type { HeaderScreenName } from '../types/screens';

export const feedbackState: { currentScreen: HeaderScreenName | null; isSending: boolean } = {
    currentScreen: null,
    isSending: false
};
