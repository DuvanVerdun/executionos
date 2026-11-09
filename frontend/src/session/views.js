// Draw the Focus and Review screens from a session.

import { formatDuration, formatDurationHoursMinutesSeconds } from '../lib/durations.js';
import { renderProgressRing } from '../shared/progress-ring.js';
import { focusDom, reviewDom } from './dom.js';

/** Update the Focus timer value and progress ring. */
export function renderFocusTimer(session, exactPercentage) {
    focusDom.currentTime.textContent = formatDuration(session.actualTimeSeconds);
    renderProgressRing(focusDom.timerRing, exactPercentage, 'var(--color-white)', 'var(--color-reward)');
}

/** Render the current mission, target, and elapsed time. */
export function renderFocusSession(session) {
    focusDom.mission.textContent = session.currentMission;
    focusDom.targetTime.textContent = formatDuration(session.targetTimeSeconds);
    focusDom.currentTime.textContent = formatDuration(session.actualTimeSeconds);
}

/** Render session results and the completion-dependent Continue button. */
export function renderReviewSession(session) {
    reviewDom.mission.textContent = session.currentMission;
    reviewDom.targetTime.textContent = `Target: ${formatDurationHoursMinutesSeconds(session.targetTimeSeconds)}`;
    reviewDom.percentage.textContent = `${session.percentageCompleted}%`;
    reviewDom.status.textContent =
        session.completionStatus.charAt(0).toUpperCase() + session.completionStatus.slice(1);
    reviewDom.actualTime.textContent = formatDurationHoursMinutesSeconds(session.actualTimeSeconds);
    renderProgressRing(reviewDom.progressRing, session.percentageCompleted, 'var(--color-cta)', 'var(--color-reward)');
    if (session.percentageCompleted >= 100) {
        reviewDom.continueButton.classList.replace('cta-button', 'normal-button');
    }
}
