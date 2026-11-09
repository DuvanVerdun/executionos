import { apiFetch } from '../auth/http';
import type { ApiResult } from '../types/api';
import type { ScreenName } from '../types/screens';

/** Submit a feedback message from the current screen. */
export function postFeedback(feedbackMessage: string, currentScreen: ScreenName | null): Promise<ApiResult<{ message: string }>> {
    return apiFetch<ApiResult<{ message: string }>>({ path: 'feedback', method: 'POST', body: { message: feedbackMessage }, currentScreen: currentScreen ?? undefined });
}
