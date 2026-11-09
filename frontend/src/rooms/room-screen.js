// Room screen: ranking, history, polling and the top menu.

import { BEAT_AVERAGE_INCREMENT_SECONDS, ROOM_POLL_INTERVAL_MS } from '../config.js';
import { formatSessionDateLabel, groupSessionsByLocalDate } from '../lib/dates.js';
import {
    formatAverageSessionTime,
    formatDurationHoursMinutes,
    formatSecondsAsHHMM
} from '../lib/durations.js';
import { handleTargetTimeKeydown } from '../session/plan.js';
import { navigateTo } from '../shared/navigation.js';
import { createSessionTimeSection, handleDeleteSession, toggleSessionMenu } from '../shared/session-cards.js';
import { fetchRoomSessions, fetchRoomSnapshot } from './api.js';
import { MEMBER_STATE_LABELS, ROOM_COPY } from './copy.js';
import { roomDom } from './dom.js';
import { renderRoomMenu, runRoomMenuAction } from './menu.js';
import { enterRoomsScreen } from './rooms-screen.js';
import { roomSnapshotCache, roomState } from './state.js';

/** Show one Room surface (loading, ready, error, or unavailable) and hide the others. */
function showRoomView(view) {
    roomDom.loading.style.display = view === 'loading' ? 'flex' : 'none';
    roomDom.data.style.display = view === 'ready' ? 'flex' : 'none';
    roomDom.error.style.display = view === 'error' ? 'flex' : 'none';
    roomDom.unavailable.style.display = view === 'unavailable' ? 'flex' : 'none';
    roomDom.menuWrapper.style.display = view === 'ready' ? 'block' : 'none';
    roomDom.title.hidden = view !== 'ready';
    roomDom.titleSkeleton.hidden = view !== 'loading';
    if (view !== 'ready') setRoomMenuState(false);
}

/** Fill the target time with the room average plus the beat increment. */
function handleBeatAverage() {
    const average = roomState.snapshot?.summary.average_session_time_seconds ?? null;
    if (average === null) {
        roomDom.mission.focus();
        return;
    }
    roomDom.targetTime.value = formatSecondsAsHHMM(average + BEAT_AVERAGE_INCREMENT_SECONDS);
    roomDom.targetTime.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Create a small label pill, such as Owner or You. */
function createRoomPill(text) {
    const pill = document.createElement('span');
    pill.className = 'room-pill';
    pill.textContent = text;
    return pill;
}

/** Create the ring that shows a member's state. */
function createMemberRing(member) {
    const ring = document.createElement('span');
    ring.className = `member-ring member-ring-${member.state.replace('_', '-')}`;
    ring.setAttribute('role', 'img');
    ring.setAttribute('aria-label', MEMBER_STATE_LABELS[member.state]);
    if (member.state === 'working') {
        ring.style.setProperty('--ring-pct', `${member.ring_percentage ?? 0}%`);
    }
    return ring;
}

/** Create one row of the ranking. */
function createRankingRow(member) {
    const row = document.createElement('div');
    const position = document.createElement('span');
    const identity = document.createElement('span');
    const name = document.createElement('span');
    const total = document.createElement('span');
    const sessions = document.createElement('span');

    row.className = 'room-ranking-row';
    row.classList.toggle('is-you', member.is_you);
    position.className = 'room-ranking-position';
    identity.className = 'room-ranking-identity';
    name.className = 'room-ranking-name';
    total.className = 'room-ranking-total';
    sessions.className = 'room-ranking-sessions';

    position.textContent = String(member.position);
    name.textContent = member.username;
    total.textContent = formatDurationHoursMinutes(member.total_time_seconds);
    sessions.textContent = `${member.sessions_count} ${member.sessions_count === 1 ? 'session' : 'sessions'}`;

    identity.appendChild(name);
    if (member.is_owner) identity.appendChild(createRoomPill('Owner'));
    if (member.is_you) identity.appendChild(createRoomPill('You'));
    row.append(position, createMemberRing(member), identity, total, sessions);
    return row;
}

/** Render the room details, summary cards, and ranking from the latest snapshot. */
function renderRoomSnapshot() {
    const { room, summary, ranking } = roomState.snapshot;
    roomDom.title.textContent = room.name;
    roomDom.totalTime.textContent = formatDurationHoursMinutes(summary.total_time_seconds);
    roomDom.sessionCount.textContent = String(summary.total_sessions);
    roomDom.peopleCount.textContent = String(summary.members_count);
    roomDom.averageTime.textContent = formatAverageSessionTime(summary.average_session_time_seconds);
    roomDom.rankingTitle.textContent = `Ranking — Members of this room (${summary.members_count})`;
    roomDom.ranking.replaceChildren(...ranking.map(createRankingRow));
    if (roomState.menuOpen) renderRoomTopMenu();
}

/** Create a room history session's author, mission, and delete menu. */
function createRoomSessionMissionSection(session) {
    const container = document.createElement('div');
    const info = document.createElement('div');
    const user = document.createElement('p');
    const username = document.createElement('span');
    const mission = document.createElement('p');

    container.className = 'dashboard-session-mission-container';
    info.className = 'room-session-info';
    user.className = 'room-session-user';
    username.className = 'room-session-username';
    mission.className = 'dashboard-session-mission';

    username.textContent = session.username;
    mission.textContent = session.mission_hidden ? 'Mission hidden' : session.mission;
    user.appendChild(username);
    if (session.is_former_member) {
        const former = document.createElement('span');
        former.className = 'room-session-former';
        former.textContent = ' (not a member anymore)';
        user.appendChild(former);
    }
    info.append(user, mission);
    container.appendChild(info);

    if (session.is_mine) {
        const openMenuIcon = document.createElement('span');
        const menu = document.createElement('div');
        const deleteButton = document.createElement('button');

        openMenuIcon.className = 'material-symbols-outlined dashboard-session-open-menu-icon dashboard-session-toggle-menu-icon';
        menu.className = 'dashboard-session-menu';
        deleteButton.className = 'dashboard-delete-session-btn';
        openMenuIcon.textContent = 'more_vert';
        deleteButton.textContent = 'Delete Session';
        deleteButton.dataset.sessionId = session.id;

        menu.appendChild(deleteButton);
        container.append(openMenuIcon, menu);
    }
    return container;
}

/** Create the aggregated metrics of one day of room sessions. */
function createRoomDailySummarySection(summary) {
    const container = document.createElement('div');
    const title = document.createElement('p');
    const metrics = document.createElement('div');
    const sessions = document.createElement('p');
    const totalTime = document.createElement('p');
    const completion = document.createElement('p');

    container.className = 'dashboard-daily-summary';
    title.className = 'dashboard-daily-summary-title';
    metrics.className = 'dashboard-daily-summary-metrics';
    title.textContent = 'Daily Summary';
    sessions.textContent = `${summary.total_sessions} sessions`;
    totalTime.textContent = `${formatDurationHoursMinutes(summary.total_time_seconds)} focused`;
    completion.textContent = `${Math.round(summary.average_completion_percentage)}% completion`;

    metrics.append(sessions, totalTime, completion);
    container.append(title, metrics);
    return container;
}

/** Build one day's card of room sessions, with its date pill and daily summary. */
function createRoomDateCard(sessions, dailySummary) {
    const card = document.createElement('div');
    const dateLabel = document.createElement('p');
    const hasSummary = Boolean(dailySummary) && dailySummary.total_sessions > 1;

    card.className = 'dashboard-session-card';
    dateLabel.className = 'dashboard-session-date';
    dateLabel.textContent = formatSessionDateLabel(sessions[0]);
    card.appendChild(dateLabel);
    if (hasSummary) card.appendChild(createRoomDailySummarySection(dailySummary));

    sessions.forEach(/** Append a session and its separator to the daily card. */ (session, index) => {
        if (index > 0 || hasSummary) {
            const divider = document.createElement('span');
            divider.className = 'dashboard-session-division-line';
            card.appendChild(divider);
        }
        card.append(createRoomSessionMissionSection(session), createSessionTimeSection(session));
    });
    return card;
}

/** Render the room history grouped into daily cards, or its empty state. */
function renderRoomHistory() {
    const groups = groupSessionsByLocalDate(roomState.sessions);
    const cards = [...groups.entries()].map(/** Build the card for one local day. */ ([dateKey, daySessions]) =>
        createRoomDateCard(daySessions, roomState.dailySummaries[dateKey])
    );
    roomDom.history.replaceChildren(...cards);
    roomDom.historyEmpty.style.display =
        roomState.historyLoaded && roomState.sessions.length === 0 ? 'flex' : 'none';
}

/** Show a history failure with its Retry button. */
function showRoomHistoryFailure(kind) {
    roomState.historyFailure = kind;
    roomState.historyObserver?.disconnect();
    roomDom.historyMessage.textContent = kind === 'first' ? ROOM_COPY.historyFailed : ROOM_COPY.moreSessionsFailed;
    roomDom.historyRetryButton.hidden = false;
    roomDom.historySentinel.style.display = 'flex';
}

/** Observe the history sentinel to load more sessions. */
function setupRoomHistoryObserver() {
    roomState.historyObserver?.disconnect();
    if (!roomState.nextCursor) {
        roomDom.historySentinel.style.display = 'none';
        return;
    }
    roomDom.historySentinel.style.display = 'flex';
    if (roomState.historyFailure) return;

    roomState.historyObserver = new IntersectionObserver(
        /** Load another history page when the sentinel enters the viewport. */
        async (entries) => {
            if (entries[0].isIntersecting) await loadMoreRoomSessions();
        },
        { root: null, rootMargin: '300px' }
    );
    roomState.historyObserver.observe(roomDom.historySentinel);
}

/** Load the first page of the room history. */
async function loadRoomHistory() {
    const generation = ++roomState.historyGeneration;
    roomState.historyObserver?.disconnect();
    roomState.isLoadingMore = false;
    roomState.historyFailure = null;
    roomDom.historyMessage.textContent = '';
    roomDom.historyRetryButton.hidden = true;

    try {
        const result = await fetchRoomSessions(roomState.roomId);
        if (generation !== roomState.historyGeneration) return;
        if (result.status === 404) {
            showUnavailableRoom();
            return;
        }
        if (!result.success) throw new Error(result.error);

        roomState.sessions = result.sessions;
        roomState.dailySummaries = result.daily_summaries;
        roomState.nextCursor = result.next_cursor;
        roomState.historyLoaded = true;
        renderRoomHistory();
        setupRoomHistoryObserver();
    } catch (error) {
        if (generation !== roomState.historyGeneration) return;
        console.error('Room history loading error:', error);
        showRoomHistoryFailure('first');
    }
}

/** Load and append the next page of the room history. */
async function loadMoreRoomSessions() {
    if (roomState.isLoading || roomState.isLoadingMore || roomState.historyFailure || !roomState.nextCursor) return;

    const generation = roomState.historyGeneration;
    roomState.isLoadingMore = true;
    roomDom.historyRetryButton.hidden = true;
    roomDom.historyMessage.textContent = 'Loading more...';

    try {
        const result = await fetchRoomSessions(roomState.roomId, roomState.nextCursor);
        if (generation !== roomState.historyGeneration) return;
        if (!result.success) throw new Error(result.error);

        roomState.sessions.push(...result.sessions);
        Object.assign(roomState.dailySummaries, result.daily_summaries);
        roomState.nextCursor = result.next_cursor;
        roomDom.historyMessage.textContent = '';
        renderRoomHistory();
    } catch (error) {
        if (generation !== roomState.historyGeneration) return;
        console.error('Room history pagination error:', error);
        showRoomHistoryFailure('more');
    } finally {
        if (generation === roomState.historyGeneration) {
            roomState.isLoadingMore = false;
            if (!roomState.historyFailure) setupRoomHistoryObserver();
        }
    }
}

/** Retry the failed history request. */
async function handleRoomHistoryRetry() {
    if (roomState.isLoadingMore) return;
    if (roomState.historyFailure === 'first') {
        await loadRoomHistory();
        return;
    }
    roomState.historyFailure = null;
    await loadMoreRoomSessions();
}

/** Load the room snapshot, and the history when it is needed. */
export async function loadRoom({ silent = false, reloadHistory = false, surfaceErrors = !silent } = {}) {
    const generation = ++roomState.loadGeneration;
    roomState.isLoading = true;
    if (!silent) showRoomView('loading');

    try {
        const result = await fetchRoomSnapshot(roomState.roomId);
        if (generation !== roomState.loadGeneration) return;
        if (result.status === 404) {
            showUnavailableRoom();
            return;
        }
        if (!result.success) throw new Error(result.error);

        const previousTotal = roomState.snapshot?.summary.total_sessions;
        roomState.snapshot = { room: result.room, summary: result.summary, ranking: result.ranking };
        roomSnapshotCache.set(roomState.roomId, roomState.snapshot);
        renderRoomSnapshot();
        showRoomView('ready');

        const totalChanged = previousTotal !== undefined && previousTotal !== result.summary.total_sessions;
        if (reloadHistory || !roomState.historyLoaded || totalChanged) await loadRoomHistory();
    } catch (error) {
        if (generation !== roomState.loadGeneration) return;
        console.error('Room loading error:', error);
        if (surfaceErrors || !roomState.snapshot) showRoomView('error');
    } finally {
        if (generation === roomState.loadGeneration) roomState.isLoading = false;
    }
}

/** Refresh the room on a timer, skipping hidden tabs and overlapping requests. */
async function pollRoom() {
    if (document.hidden || roomState.isLoading) return;
    await loadRoom({ silent: true });
}

/** Start polling the room every 15 seconds. */
export function startRoomPolling() {
    stopRoomPolling();
    roomState.pollTimer = setInterval(pollRoom, ROOM_POLL_INTERVAL_MS);
}

/** Stop polling the room. */
function stopRoomPolling() {
    clearInterval(roomState.pollTimer);
    roomState.pollTimer = null;
}

/** Forget the previous room and prepare a clean Room screen. */
function resetRoomState(roomId) {
    stopRoomPolling();
    roomState.historyObserver?.disconnect();
    roomState.loadGeneration += 1;
    roomState.historyGeneration += 1;
    Object.assign(roomState, {
        roomId,
        snapshot: null,
        sessions: [],
        dailySummaries: {},
        nextCursor: null,
        historyLoaded: false,
        historyFailure: null,
        isLoading: false,
        isLoadingMore: false,
        busyAction: null
    });
    roomDom.history.replaceChildren();
    roomDom.historyEmpty.style.display = 'none';
    roomDom.historySentinel.style.display = 'none';
    roomDom.historyMessage.textContent = '';
    roomDom.historyRetryButton.hidden = true;
    roomDom.mission.value = '';
    roomDom.targetTime.value = '00:00';
    roomDom.missionError.textContent = '';
    roomDom.timeError.textContent = '';
    roomDom.mission.removeAttribute('aria-invalid');
    roomDom.targetTime.removeAttribute('aria-invalid');
    showRoomView('loading');
}

/** Stop everything the Room screen started. */
export function leaveRoomScreen() {
    stopRoomPolling();
    roomState.historyObserver?.disconnect();
    roomState.loadGeneration += 1;
    roomState.historyGeneration += 1;
    roomState.isLoading = false;
    setRoomMenuState(false);
}

/** Open a room from another screen and load it. */
export async function openRoom(roomId, currentScreen) {
    resetRoomState(roomId);
    const cached = roomSnapshotCache.get(roomId);
    if (cached) {
        roomState.snapshot = cached;
        renderRoomSnapshot();
        showRoomView('ready');
    }
    navigateTo('room', currentScreen);
    startRoomPolling();
    await loadRoom({ silent: Boolean(cached), reloadHistory: Boolean(cached), surfaceErrors: true });
}

/** Show the "This room isn't available" state, from the Room screen or another one. */
export function showUnavailableRoom(currentScreen = null) {
    if (currentScreen !== null) {
        resetRoomState(null);
        navigateTo('room', currentScreen);
    }
    stopRoomPolling();
    roomState.historyObserver?.disconnect();
    showRoomView('unavailable');
}

/** Go back to the Rooms screen. */
async function handleRoomBack() {
    navigateTo('rooms', 'room');
    await enterRoomsScreen();
}

/** Retry loading the room after a failed first load. */
async function handleRoomRetry() {
    if (roomDom.retryButton.disabled) return;
    roomDom.retryButton.disabled = true;
    roomDom.retryButton.textContent = 'Retrying…';
    try {
        await loadRoom();
    } finally {
        roomDom.retryButton.disabled = false;
        roomDom.retryButton.textContent = 'Retry';
    }
}

/** Redraw the top bar menu from the latest snapshot. */
function renderRoomTopMenu() {
    if (!roomState.snapshot) return;
    renderRoomMenu(roomDom.menu, roomState.snapshot.room, roomState.busyAction);
}

/** Open or close the top bar menu. */
export function setRoomMenuState(open) {
    roomState.menuOpen = open;
    roomDom.menu.hidden = !open;
    roomDom.menuButton.setAttribute('aria-expanded', String(open));
    if (open) renderRoomTopMenu();
}

const roomMenuHooks = {
    screen: 'room',
    /** Report whether a Room menu action is running. */
    isBusy: () => roomState.busyAction !== null,
    /** Record the running Room menu action and redraw the menu. */
    setBusy(action) {
        roomState.busyAction = action;
        renderRoomTopMenu();
    },
    /** Return to Rooms after the room is left or deleted. */
    async onRemoved() {
        setRoomMenuState(false);
        await handleRoomBack();
    }
};

/** Handle a click on a top bar menu action. */
async function handleRoomMenuClick(event) {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton || actionButton.disabled || !roomState.snapshot) return;
    await runRoomMenuAction(actionButton.dataset.action, roomState.snapshot.room, roomMenuHooks);
}

/** Close the top bar menu when clicking outside it. */
function closeRoomTopMenuOnOutsideClick(event) {
    if (!roomState.menuOpen || roomState.busyAction !== null) return;
    if (event.target.closest('#room-menu-wrapper')) return;
    setRoomMenuState(false);
}

/** Connect the Room screen. */
export function initRoomScreen() {
    for (const [input, message] of [
        [roomDom.mission, roomDom.missionError], [roomDom.targetTime, roomDom.timeError]
    ]) {
        input.addEventListener('input', /** Clear a plan field error when its value changes. */ () => {
            message.textContent = '';
            input.removeAttribute('aria-invalid');
        });
    }
    roomDom.backButton.addEventListener('click', handleRoomBack);
    roomDom.unavailableBackButton.addEventListener('click', handleRoomBack);
    roomDom.retryButton.addEventListener('click', handleRoomRetry);
    roomDom.menuButton.addEventListener('click', /** Toggle the Room top bar menu. */ () => setRoomMenuState(!roomState.menuOpen));
    roomDom.menu.addEventListener('click', handleRoomMenuClick);
    document.addEventListener('click', closeRoomTopMenuOnOutsideClick);
    roomDom.beatButton.addEventListener('click', handleBeatAverage);
    roomDom.targetTime.addEventListener('keydown', handleTargetTimeKeydown);
    roomDom.history.addEventListener('click', toggleSessionMenu);
    roomDom.history.addEventListener('click', /** Delete a Room session and reload the Room and its history. */ (event) => handleDeleteSession(event, 'room', /** Reload the Room snapshot and history after a deletion. */ () => loadRoom({ silent: true, reloadHistory: true })));
    roomDom.historyRetryButton.addEventListener('click', handleRoomHistoryRetry);
    document.addEventListener('visibilitychange', /** Refresh the room as soon as the tab is visible again. */ () => {
        if (!document.hidden && roomState.pollTimer !== null) void pollRoom();
    });
}
