// The button that scrolls the Dashboard back up to its statistics.

import { dashboardDom } from './dom.js';

/** Show the shortcut when session history reaches the top of the viewport. */
export function updateBackToStatsButton() {
    const firstCard = dashboardDom.sessionsList.querySelector('.dashboard-session-card');
    const disabled = !firstCard
        || firstCard.getClientRects().length === 0
        || firstCard.getBoundingClientRect().top > 0;
    dashboardDom.backToStatsButton.disabled = disabled;
    dashboardDom.backToStatsButton.setAttribute('aria-hidden', String(disabled));
}

/** Return to Stats below the sticky header, respecting reduced motion. */
export function handleBackToStats() {
    const header = dashboardDom.screen.querySelector('.dashboard-header');
    const top = window.scrollY + dashboardDom.summaryContainer.getBoundingClientRect().top
        - header.getBoundingClientRect().bottom - 24;
    dashboardDom.summaryContainer.focus({ preventScroll: true });
    window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    });
}
