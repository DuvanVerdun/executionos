// The streak button and its consistency calendar.

import { dashboardDom } from '../dashboard/dom';
import { at } from '../lib/arrays';
import { formatLocalDate, parseLocalDate, shiftMonthAnchor } from '../lib/dates';
import { roomsDom } from '../rooms/dom';
import { planDom } from '../session/dom';
import { HEADER_SCREENS, screenDom } from '../shared/screens';
import type { StreakData } from '../types/dashboard';
import type { HeaderScreenName, ScreenName } from '../types/screens';
import { fetchStreak } from './api';
import { streakState } from './state';

/** Reset streak data and calendar navigation state. */
export function initializeStreakState(): void {
    if (!streakState.anchorDate) {
        streakState.anchorDate = formatLocalDate(new Date());
    }
}

/** Build the consistency calendar and its month navigation controls. */
function renderStreakPopup(
    screen: HeaderScreenName,
    data: StreakData,
    { isLoading = false, failed = false }: { isLoading?: boolean; failed?: boolean } = {}
): void {
    const popup = screenDom[screen].streakPopup;

    popup.innerHTML = '';

    const header = document.createElement('div');
    const previousButton = document.createElement('button');
    const title = document.createElement('p');
    const nextButton = document.createElement('button');

    header.className = 'streak-calendar-header';
    previousButton.type = 'button';
    nextButton.type = 'button';
    previousButton.setAttribute('aria-label', 'Previous month');
    nextButton.setAttribute('aria-label', 'Next month');
    previousButton.textContent = '<';
    nextButton.textContent = '>';

    const monthDate = parseLocalDate(
        `${data.calendar.month}-01`
    );

    title.textContent = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric'
    }).format(monthDate);

    header.append(
        previousButton,
        title,
        nextButton
    );

    popup.appendChild(header);

    previousButton.addEventListener('click', /** Show the previous calendar month. */ () => {
        streakState.anchorDate = shiftMonthAnchor(streakState.anchorDate, -1);
        void loadStreak(screen);
    });
    nextButton.addEventListener('click', /** Show the next calendar month. */ () => {
        streakState.anchorDate = shiftMonthAnchor(streakState.anchorDate, 1);
        void loadStreak(screen);
    });

    if (failed) {
        const error = document.createElement('div');
        error.className = 'streak-calendar-error';
        const message = document.createElement('p');
        message.setAttribute('role', 'alert');
        message.textContent = 'Couldn’t load this month. Try again.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'normal-button';
        retry.textContent = 'Retry';
        retry.addEventListener('click', /** Retry the selected calendar month. */ () => {
            void loadStreak(screen);
        });
        error.append(message, retry);
        popup.appendChild(error);
        return;
    }

    const calendar = document.createElement('div');
    calendar.className = 'streak-calendar';
    calendar.setAttribute('aria-busy', String(isLoading));
    if (isLoading) calendar.setAttribute('aria-label', 'Loading calendar');

    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(
        /** Append a weekday heading to the consistency calendar. */
        (weekday) => {
            const label = document.createElement('span');
            label.textContent = weekday;
            calendar.appendChild(label);
        }
    );

    const firstDay = parseLocalDate(
        at(data.calendar.days, 0).date
    );

    const emptyCellsBeforeFirstDay =
        (firstDay.getDay() + 6) % 7;

    for (
        let index = 0;
        index < emptyCellsBeforeFirstDay;
        index++
    ) {
        calendar.appendChild(
            document.createElement('span')
        );
    }

    data.calendar.days.forEach(/** Append a day with its work, rest, or neutral state. */ (day) => {
        const dayElement = document.createElement('span');
        const visualState = day.state === 'work' || day.state === 'rest'
            ? day.state
            : 'neutral';

        dayElement.className =
            `streak-calendar-day streak-calendar-day-${visualState}`;

        dayElement.textContent =
            String(parseLocalDate(day.date).getDate());

        if (isLoading) dayElement.setAttribute('aria-hidden', 'true');
        else dayElement.title = visualState;

        calendar.appendChild(dayElement);
    });

    popup.appendChild(calendar);
    if (isLoading) {
        const footer = document.createElement('div');
        footer.className = 'dashboard-skeleton streak-calendar-loading-footer';
        footer.setAttribute('aria-hidden', 'true');
        popup.appendChild(footer);
        return;
    }

    const legend = document.createElement('div');
    legend.className = 'streak-calendar-legend';
    for (const [state, label] of [['work', 'Work'], ['rest', 'Rest']] as const) {
        const item = document.createElement('div');
        const marker = document.createElement('span');
        const text = document.createElement('span');
        marker.className = `streak-calendar-legend-marker streak-calendar-day-${state}`;
        marker.setAttribute('aria-hidden', 'true');
        text.textContent = label;
        item.append(marker, text);
        legend.appendChild(item);
    }
    popup.appendChild(legend);

    const restDays = document.createElement('p');
    restDays.className = 'streak-calendar-rest-days';
    const remaining = data.rest_days_remaining_this_week;

    restDays.textContent =
        `${remaining} rest ${remaining === 1 ? 'day' : 'days'} remaining this week.`;

    popup.appendChild(restDays);
}

/** Update streak values and calendars on Plan and Dashboard. */
function renderStreak(data: StreakData): void {
    for (const screen of HEADER_SCREENS) {
        screenDom[screen].streakButton.textContent =
            `🔥 ${data.current_streak}`;

        renderStreakPopup(screen, data);
    }
}

/** Fetch and render streak information for the current calendar selection. */
export async function loadStreak(currentScreen: ScreenName): Promise<void> {
    const generation = ++streakState.loadGeneration;
    const anchorDate = streakState.anchorDate;
    const month = parseLocalDate(anchorDate);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    // Placeholder calendar for the loading and failed views. Only its calendar is drawn; the other fields are unused there.
    const pendingData: StreakData = {
        current_streak: 0,
        rest_days_remaining_this_week: 0,
        calendar: {
            month: anchorDate.slice(0, 7),
            days: Array.from({ length: daysInMonth }, /** Create a neutral placeholder for each calendar day. */ (_, index) => ({
                date: `${anchorDate.slice(0, 7)}-${String(index + 1).padStart(2, '0')}`,
                state: 'neutral'
            }))
        }
    };
    for (const screen of HEADER_SCREENS) {
        renderStreakPopup(screen, pendingData, { isLoading: true });
    }
    try {
        const result = await fetchStreak(
            anchorDate,
            currentScreen
        );
        if (generation !== streakState.loadGeneration) return;

        if (!result.success) {
            throw new Error(result.error);
        }

        renderStreak(result);

    } catch (error) {
        if (generation !== streakState.loadGeneration) return;
        console.error('Streak loading error:', error);
        for (const screen of HEADER_SCREENS) {
            renderStreakPopup(screen, pendingData, { failed: true });
        }
    }
}

/** Toggle the selected screen's consistency calendar. */
function toggleStreakPopup(screen: HeaderScreenName): void {
    const isOpen =
        streakState.openScreen === screen;

    HEADER_SCREENS.forEach(/** Hide this screen's consistency calendar. */ (headerScreen) => {
        screenDom[headerScreen].streakPopup.style.display = 'none';
    });

    if (isOpen) {
        streakState.openScreen = null;
        return;
    }

    screenDom[screen].streakPopup.style.display = 'block';
    streakState.openScreen = screen;
}

/** Close the consistency calendar on outside clicks. */
function closeStreakPopupsOnOutsideClick(event: MouseEvent): void {
    if (!streakState.openScreen) return;

    const screen = streakState.openScreen;
    const clickPath = event.composedPath();

    if (
        clickPath.includes(screenDom[screen].streakPopup)
        || clickPath.includes(screenDom[screen].streakButton)
    ) {
        return;
    }

    screenDom[screen].streakPopup.style.display = 'none';
    streakState.openScreen = null;
}

/** Connect the streak buttons and close their popups on outside clicks. */
export function initStreak(): void {
    planDom.streakButton.addEventListener('click', /** Toggle the Plan consistency calendar. */ () => toggleStreakPopup('plan'));
    dashboardDom.streakButton.addEventListener('click', /** Toggle the Dashboard consistency calendar. */ () => toggleStreakPopup('dashboard'));
    roomsDom.streakButton.addEventListener('click', /** Toggle the Rooms consistency calendar. */ () => toggleStreakPopup('rooms'));
    document.addEventListener('click', closeStreakPopupsOnOutsideClick);
}
