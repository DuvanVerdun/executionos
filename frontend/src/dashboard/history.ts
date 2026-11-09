// The session history cards of the Dashboard.

import { formatSessionDateLabel, getSessionLocalDateKey, groupSessionsByLocalDate } from '../lib/dates';
import { at } from '../lib/arrays';
import { formatDurationHoursMinutes } from '../lib/durations';
import { createSessionTimeSection } from '../shared/session-cards';
import type { DailySummary, HistorySession } from '../types/session';
import { updateBackToStatsButton } from './back-to-stats';
import { dashboardDom } from './dom';
import { dashboardState } from './state';

/** Create the session history heading. */
function createSessionListTitle(): HTMLHeadingElement {
    const title = document.createElement('h2');
    title.className = 'dashboard-content-title';
    title.textContent = 'Session History';
    return title;
}

/** Create a session's mission and deletion menu. */
function createSessionMissionSection(session: HistorySession): HTMLDivElement {
    const container = document.createElement('div');
    const mission = document.createElement('p');
    const openMenuIcon = document.createElement('span');
    const menu = document.createElement('div');
    const deleteButton = document.createElement('button');

    container.className = 'dashboard-session-mission-container';
    mission.className = 'dashboard-session-mission';
    openMenuIcon.className = 'material-symbols-outlined dashboard-session-open-menu-icon dashboard-session-toggle-menu-icon';
    menu.className = 'dashboard-session-menu';
    deleteButton.className = 'dashboard-delete-session-btn';

    mission.textContent = session.mission;
    openMenuIcon.textContent = 'more_vert';
    deleteButton.textContent = 'Delete Session';
    deleteButton.dataset.sessionId = String(session.id);

    container.append(mission, openMenuIcon, menu);
    menu.append(deleteButton);
    return container;
}

/** Create aggregated metrics for a day of sessions. */
function createDailySummarySection(summary: DailySummary): HTMLDivElement {
    const container = document.createElement('div');
    const title = document.createElement('p');
    const metrics = document.createElement('div');
    const totalTime = document.createElement('p');
    const sessions = document.createElement('p');
    const completion = document.createElement('p');

    container.className = 'dashboard-daily-summary';
    title.className = 'dashboard-daily-summary-title';
    metrics.className = 'dashboard-daily-summary-metrics';
    title.textContent = 'Daily Summary';
    totalTime.textContent = `${formatDurationHoursMinutes(summary.total_time_seconds)} focused`;
    sessions.textContent = `${summary.total_sessions} sessions`;
    completion.textContent = `${Math.round(summary.average_completion_percentage)}% avg. completion`;

    metrics.append(sessions, totalTime, completion);
    container.append(title, metrics);
    return container;
}

/** Append mission and time sections to a session card. */
function appendSessionToCard(session: HistorySession, card: HTMLElement): void {
    card.append(createSessionMissionSection(session), createSessionTimeSection(session));
}

/** Build a daily history card with an optional aggregate summary. */
function createSessionDateCard(
    sessions: HistorySession[],
    dailySummary: DailySummary | undefined
): HTMLDivElement {
    const firstSession = at(sessions, 0);

    const card = document.createElement('div');
    const dateLabel = document.createElement('p');

    const dateKey =
        getSessionLocalDateKey(firstSession);

    card.className = 'dashboard-session-card';
    card.id = `session-card-${dateKey}`;

    dateLabel.className = 'dashboard-session-date';
    dateLabel.textContent =
        formatSessionDateLabel(firstSession);

    card.appendChild(dateLabel);

    if (
        dailySummary
        && dailySummary.total_sessions > 1
    ) {
        card.appendChild(
            createDailySummarySection(dailySummary)
        );
    }

    sessions.forEach(/** Append a session and its separator to the daily card. */ (session, index) => {
        if (index > 0 || (dailySummary && dailySummary.total_sessions > 1)) {
            const divider =
                document.createElement('span');

            divider.className =
                'dashboard-session-division-line';

            card.appendChild(divider);
        }

        appendSessionToCard(session, card);
    });

    return card;
}

/** Render session history grouped into daily cards. */
export function renderSessionsByDate(sessions: HistorySession[]): void {
    dashboardDom.sessionsList.innerHTML = '';
    dashboardDom.sessionsList.appendChild(createSessionListTitle());
    if (sessions.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No sessions in this period.';
        emptyMessage.className = 'dashboard-empty-period-message';
        dashboardDom.sessionsList.appendChild(emptyMessage);
        updateBackToStatsButton();
        return;
    }
    const groups = groupSessionsByLocalDate(sessions);
    for (const [dateKey, daySessions] of groups.entries()) {
    const dailySummary =
        dashboardState.dailySummaries[dateKey];

    dashboardDom.sessionsList.appendChild(
        createSessionDateCard(
            daySessions,
            dailySummary
        )
    );
}
    dashboardDom.sessionsList.appendChild(
        dashboardDom.sessionsLoadSentinel
    );
    updateBackToStatsButton();
}
