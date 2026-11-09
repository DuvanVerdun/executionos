// Rooms screen: the list of rooms and the create, join and created modals.

import { ROOM_POLL_INTERVAL_MS } from '../config';
import { loadDashboard } from '../dashboard/dashboard';
import { dashboardDom } from '../dashboard/dom';
import { at } from '../lib/arrays';
import { closestElement, getAllElements, getElement } from '../lib/dom';
import { formatDurationHoursMinutes } from '../lib/durations';
import { errorStatus } from '../lib/errors';
import { planDom } from '../session/dom';
import { setFloatingMessage } from '../shared/floating-message';
import { navigateTo } from '../shared/navigation';
import { loadStreak } from '../streak/calendar';
import { isRoomMenuAction } from '../types/rooms';
import type { RoomCard, RoomMenuHooks } from '../types/rooms';
import type { ScreenName } from '../types/screens';
import { fetchRooms, postJoinRoom, postRoom } from './api';
import { ROOM_COPY } from './copy';
import { modalsDom, roomsDom } from './dom';
import { buildRoomDisplayLink, buildRoomLink, extractRoomLinkToken } from './links';
import { renderRoomMenu, runRoomMenuAction } from './menu';
import { openRoom, setRoomMenuState } from './room-screen';
import { modalState, roomState, roomsState } from './state';

/** Show one Rooms surface (loading, rooms, empty, or error) and hide the others. */
function showRoomsSurface(surface: 'loading' | 'rooms' | 'empty' | 'error'): void {
    roomsDom.loading.style.display = surface === 'loading' ? 'grid' : 'none';
    roomsDom.grid.style.display = surface === 'rooms' ? 'grid' : 'none';
    roomsDom.empty.style.display = surface === 'empty' ? 'flex' : 'none';
    roomsDom.error.style.display = surface === 'error' ? 'flex' : 'none';
}

/** Build a room card with its menu button and an empty menu. */
function createRoomCard(room: RoomCard): HTMLElement {
    const card = document.createElement('article');
    const header = document.createElement('div');
    const titleBlock = document.createElement('div');
    const name = document.createElement('p');
    const members = document.createElement('p');
    const menuWrapper = document.createElement('div');
    const menuToggle = document.createElement('button');
    const menuIcon = document.createElement('span');
    const menu = document.createElement('div');
    const total = document.createElement('div');
    const totalValue = document.createElement('p');
    const totalLabel = document.createElement('p');
    const status = document.createElement('p');
    const statusDot = document.createElement('span');
    const statusText = document.createElement('span');

    card.className = 'room-card';
    card.dataset.roomId = String(room.id);
    header.className = 'room-card-header';
    name.className = 'room-card-name';
    members.className = 'room-card-members';
    menuWrapper.className = 'room-menu-wrapper';
    menuToggle.type = 'button';
    menuToggle.className = 'room-menu-toggle';
    menuToggle.dataset.action = 'toggle-menu';
    menuToggle.setAttribute('aria-label', `Open menu for ${room.name}`);
    menuToggle.setAttribute('aria-haspopup', 'menu');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuIcon.className = 'material-symbols-outlined';
    menuIcon.setAttribute('aria-hidden', 'true');
    menu.className = 'room-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    totalValue.className = 'room-card-total';
    totalLabel.className = 'room-card-total-label';
    status.className = 'room-card-status';
    statusDot.className = 'room-card-status-dot';

    name.textContent = room.name;
    members.textContent = `${room.members_count} ${room.members_count === 1 ? 'member' : 'members'}`;
    menuIcon.textContent = 'more_vert';
    totalValue.textContent = formatDurationHoursMinutes(room.my_total_time_seconds);
    totalLabel.textContent = 'Your total time ever';
    statusDot.classList.toggle('is-active', room.working_now_count > 0);
    statusText.textContent = `${room.working_now_count} working now`;

    titleBlock.append(name, members);
    menuToggle.appendChild(menuIcon);
    menuWrapper.append(menuToggle, menu);
    header.append(titleBlock, menuWrapper);
    total.append(totalValue, totalLabel);
    status.append(statusDot, statusText);
    card.append(header, total, status);
    return card;
}

/** Render room cards, or the empty state when the user has no rooms. */
function renderRooms(): void {
    if (roomsState.openMenuRoomId !== null) {
        roomsState.renderDeferred = true;
        return;
    }
    roomsState.renderDeferred = false;
    roomsDom.grid.replaceChildren(...roomsState.rooms.map(createRoomCard));
    showRoomsSurface(roomsState.rooms.length > 0 ? 'rooms' : 'empty');
}

/** Open the menu of one room, or close every menu when no room is given. */
function setRoomMenuOpen(roomId: number | null): void {
    roomsState.openMenuRoomId = roomId;
    getAllElements('.room-card', HTMLElement, roomsDom.grid).forEach(/** Show or hide this card's menu. */ (card) => {
        const isOpen = Number(card.dataset.roomId) === roomId;
        const room = roomsState.rooms.find(/** Match the card's room. */ (item) => item.id === Number(card.dataset.roomId));
        const menu = getElement('.room-menu', HTMLElement, card);
        menu.hidden = !isOpen;
        getElement('.room-menu-toggle', HTMLElement, card).setAttribute('aria-expanded', String(isOpen));
        if (isOpen && room) renderRoomMenu(menu, room, roomsState.busyAction);
    });
    if (roomId === null && roomsState.renderDeferred) renderRooms();
}

/** Redraw the open menu, for example after an action starts or ends. */
function refreshOpenRoomMenu(): void {
    if (roomsState.openMenuRoomId === null) return;
    const card = roomsDom.grid.querySelector(`.room-card[data-room-id="${roomsState.openMenuRoomId}"]`);
    const room = roomsState.rooms.find(/** Match the open menu's room. */ (item) => item.id === roomsState.openMenuRoomId);
    if (!card || !room) return;
    renderRoomMenu(getElement('.room-menu', HTMLElement, card), room, roomsState.busyAction);
}

/** Load the user's rooms. A silent load keeps what is on screen while it runs. */
async function loadRooms({ silent = false, surfaceErrors = !silent }: { silent?: boolean; surfaceErrors?: boolean } = {}): Promise<void> {
    const generation = ++roomsState.loadGeneration;
    roomsState.isLoading = true;
    if (!silent && !roomsState.hasLoaded) showRoomsSurface('loading');

    try {
        const result = await fetchRooms();
        if (generation !== roomsState.loadGeneration) return;
        if (!result.success) throw new Error(result.error);

        roomsState.rooms = result.rooms;
        roomsState.hasLoaded = true;
        renderRooms();
    } catch (error) {
        if (generation !== roomsState.loadGeneration) return;
        console.error('Rooms loading error:', error);
        if (surfaceErrors || !roomsState.hasLoaded) showRoomsSurface('error');
    } finally {
        if (generation === roomsState.loadGeneration) roomsState.isLoading = false;
    }
}

/** Refresh the rooms on a timer, skipping hidden tabs and overlapping requests. */
async function pollRooms(): Promise<void> {
    if (document.hidden || roomsState.isLoading) return;
    await loadRooms({ silent: true });
}

/** Start polling the rooms every 15 seconds. */
function startRoomsPolling(): void {
    stopRoomsPolling();
    roomsState.pollTimer = setInterval(pollRooms, ROOM_POLL_INTERVAL_MS);
}

/** Stop polling the rooms. */
function stopRoomsPolling(): void {
    clearInterval(roomsState.pollTimer ?? undefined);
    roomsState.pollTimer = null;
}

/** Stop everything the Rooms screen started. */
export function leaveRoomsScreen(): void {
    stopRoomsPolling();
    roomsState.loadGeneration += 1;
    roomsState.isLoading = false;
    roomsState.openMenuRoomId = null;
    roomsState.renderDeferred = false;
    closeModal();
}

/** Prepare the Rooms screen after it is shown, and load its rooms. */
export async function enterRoomsScreen(): Promise<void> {
    roomsState.openMenuRoomId = null;
    if (roomsState.hasLoaded) renderRooms();
    startRoomsPolling();
    void loadStreak('rooms');
    await loadRooms();
}

/** Open Rooms from a header screen. */
async function handleOpenRooms(currentScreen: ScreenName): Promise<void> {
    navigateTo('rooms', currentScreen);
    await enterRoomsScreen();
}

/** Go from Rooms to mission planning. */
function handleRoomsToPlan(): void {
    navigateTo('plan', 'rooms');
}

/** Go from Rooms to the Dashboard and load it. */
async function handleRoomsToDashboard(): Promise<void> {
    navigateTo('dashboard', 'rooms');
    await loadDashboard();
}

/** Reload the rooms after a failed first load. */
async function handleRoomsRetry(): Promise<void> {
    if (roomsDom.retryButton.disabled) return;
    roomsDom.retryButton.disabled = true;
    roomsDom.retryButton.textContent = 'Retrying…';
    roomsState.hasLoaded = false;
    try {
        await loadRooms();
    } finally {
        roomsDom.retryButton.disabled = false;
        roomsDom.retryButton.textContent = 'Retry';
    }
}

const roomsMenuHooks: RoomMenuHooks = {
    screen: 'rooms',
    /** Report whether a Rooms menu action is running. */
    isBusy: () => roomsState.busyAction !== null,
    /** Record the running Rooms menu action and redraw the open menu. */
    setBusy(action) {
        roomsState.busyAction = action;
        refreshOpenRoomMenu();
    },
    /** Close the menu and reload the rooms after a room is left or deleted. */
    async onRemoved() {
        setRoomMenuOpen(null);
        await loadRooms({ silent: true });
    }
};

/** Handle clicks inside the rooms grid: menu buttons, menu actions, and opening a room. */
async function handleRoomsGridClick(event: MouseEvent): Promise<void> {
    const card = closestElement(event.target, '.room-card', HTMLElement);
    if (!card) return;
    const roomId = Number(card.dataset.roomId);
    const actionButton = closestElement(event.target, '[data-action]', HTMLButtonElement);
    if (actionButton) {
        if (actionButton.disabled) return;
        const action = actionButton.dataset.action;
        if (action === 'toggle-menu') {
            setRoomMenuOpen(roomsState.openMenuRoomId === roomId ? null : roomId);
            return;
        }
        const room = roomsState.rooms.find(/** Match the room the action targets. */ (item) => item.id === roomId);
        if (room && isRoomMenuAction(action)) await runRoomMenuAction(action, room, roomsMenuHooks);
        return;
    }
    if (closestElement(event.target, '.room-menu-wrapper', Element)) return;
    await openRoom(roomId, 'rooms');
}

/** Close the open room menu when clicking outside it. */
function closeRoomMenuOnOutsideClick(event: MouseEvent): void {
    if (roomsState.openMenuRoomId === null || roomsState.busyAction !== null) return;
    if (closestElement(event.target, '.room-menu, .room-menu-toggle', Element)) return;
    setRoomMenuOpen(null);
}

/** Show a modal over the current screen and move focus into it. */
function openModal(overlay: HTMLElement, focusTarget: HTMLElement): void {
    modalState.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalState.openOverlay = overlay;
    overlay.hidden = false;
    focusTarget.focus();
}

/** Keep Tab and Shift+Tab inside the open modal. */
function trapModalFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const overlay = event.currentTarget;
    if (!(overlay instanceof Element)) return;
    const focusable = getAllElements('button:not(:disabled), input', HTMLElement, overlay);
    if (focusable.length === 0) return;
    const first = at(focusable, 0);
    const last = at(focusable, focusable.length - 1);
    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

/** Close the open modal and return focus to where it came from. */
function closeModal(): void {
    if (!modalState.openOverlay) return;
    modalState.openOverlay.hidden = true;
    modalState.openOverlay = null;
    modalState.returnFocus?.focus();
    modalState.returnFocus = null;
}

/** Show an error under a modal field and mark its input invalid. */
function showModalFieldError(input: HTMLInputElement, errorElement: HTMLParagraphElement, message: string): void {
    errorElement.textContent = message;
    input.setAttribute('aria-invalid', 'true');
}

/** Clear a modal field's error and invalid marker. */
function clearModalFieldError(input: HTMLInputElement, errorElement: HTMLParagraphElement): void {
    errorElement.textContent = '';
    input.removeAttribute('aria-invalid');
}

/** Lock or unlock a modal's submit button with its in-flight label. */
function setModalSubmitting(submitButton: HTMLButtonElement, isSubmitting: boolean, label: string): void {
    modalState.isSubmitting = isSubmitting;
    submitButton.disabled = isSubmitting;
    submitButton.textContent = label;
}

/** Open the Create Room form with a clean field. */
function openCreateRoomModal(): void {
    const modal = modalsDom.create;
    modal.input.value = '';
    clearModalFieldError(modal.input, modal.error);
    openModal(modal.overlay, modal.input);
}

/** Open the Join Room form with a clean field. */
function openJoinRoomModal(): void {
    const modal = modalsDom.join;
    modal.input.value = '';
    clearModalFieldError(modal.input, modal.error);
    openModal(modal.overlay, modal.input);
}

/** Validate the room name, create the room, and show its link. */
async function handleCreateRoomSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (modalState.isSubmitting) return;
    const modal = modalsDom.create;
    clearModalFieldError(modal.input, modal.error);
    const name = modal.input.value.trim();
    if (!name) {
        showModalFieldError(modal.input, modal.error, ROOM_COPY.roomNameRequired);
        modal.input.focus();
        return;
    }

    setModalSubmitting(modal.submitButton, true, 'Creating Room…');
    try {
        const result = await postRoom(name);
        if (result.success !== true) {
            showModalFieldError(modal.input, modal.error, ROOM_COPY.createFailed);
            return;
        }
        modalState.roomLink = buildRoomLink(result.room.link_token);
        modalsDom.created.link.value = buildRoomDisplayLink(result.room.link_token);
        closeModal();
        openModal(modalsDom.created.overlay, modalsDom.created.copyButton);
        void loadRooms({ silent: true });
    } catch (error) {
        if (errorStatus(error) === 401) return;
        console.error('Could not create the room:', error);
        showModalFieldError(modal.input, modal.error, ROOM_COPY.serverUnreachable);
    } finally {
        setModalSubmitting(modal.submitButton, false, 'Create Room');
    }
}

/** Copy the new room's link and confirm it. */
async function handleCopyRoomLink(): Promise<void> {
    try {
        await navigator.clipboard.writeText(modalState.roomLink);
        setFloatingMessage(ROOM_COPY.linkCopied);
    } catch (error) {
        console.error('Could not copy the room link:', error);
        setFloatingMessage(ROOM_COPY.copyFailed, { error: true });
    }
}

/** Validate the pasted link and join the room. */
async function handleJoinRoomSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (modalState.isSubmitting) return;
    const modal = modalsDom.join;
    clearModalFieldError(modal.input, modal.error);
    const linkToken = extractRoomLinkToken(modal.input.value);
    if (!linkToken) {
        showModalFieldError(modal.input, modal.error, ROOM_COPY.roomLinkRequired);
        modal.input.focus();
        return;
    }

    setModalSubmitting(modal.submitButton, true, 'Joining Room…');
    try {
        const result = await postJoinRoom(linkToken);
        if (result.success === true) {
            closeModal();
            await openRoom(result.room.id, 'rooms');
            return;
        }
        const invalid = result.status === 400 || result.status === 404;
        showModalFieldError(modal.input, modal.error, invalid ? ROOM_COPY.invalidLink : ROOM_COPY.joinFailed);
    } catch (error) {
        if (errorStatus(error) === 401) return;
        console.error('Could not join the room:', error);
        showModalFieldError(modal.input, modal.error, ROOM_COPY.serverUnreachable);
    } finally {
        setModalSubmitting(modal.submitButton, false, 'Join Room');
    }
}

/** Close the open modal or room menu with Escape. */
function handleRoomsKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (modalState.openOverlay && !modalState.isSubmitting) {
        closeModal();
    } else if (roomsState.openMenuRoomId !== null && roomsState.busyAction === null) {
        setRoomMenuOpen(null);
    } else if (roomState.menuOpen && roomState.busyAction === null) {
        setRoomMenuState(false);
    }
}

/** Connect the Rooms screen and its modals. */
export function initRoomsScreen(): void {
    planDom.roomsButton.addEventListener('click', /** Open Rooms from Plan. */ () => handleOpenRooms('plan'));
    dashboardDom.roomsButton.addEventListener('click', /** Open Rooms from Dashboard. */ () => handleOpenRooms('dashboard'));
    roomsDom.newMissionButton.addEventListener('click', handleRoomsToPlan);
    roomsDom.dashboardButton.addEventListener('click', handleRoomsToDashboard);
    roomsDom.createButton.addEventListener('click', openCreateRoomModal);
    roomsDom.emptyCreateButton.addEventListener('click', openCreateRoomModal);
    roomsDom.joinButton.addEventListener('click', openJoinRoomModal);
    roomsDom.retryButton.addEventListener('click', handleRoomsRetry);
    roomsDom.grid.addEventListener('click', handleRoomsGridClick);
    document.addEventListener('click', closeRoomMenuOnOutsideClick);
    document.addEventListener('keydown', handleRoomsKeydown);
    document.addEventListener('visibilitychange', /** Refresh the rooms as soon as the tab is visible again. */ () => {
        if (!document.hidden && roomsState.pollTimer !== null) void pollRooms();
    });
    modalsDom.create.form.addEventListener('submit', handleCreateRoomSubmit);
    modalsDom.join.form.addEventListener('submit', handleJoinRoomSubmit);
    modalsDom.created.copyButton.addEventListener('click', handleCopyRoomLink);
    modalsDom.created.link.addEventListener('focus', /** Select the whole link for manual copying. */ () => modalsDom.created.link.select());
    [modalsDom.create, modalsDom.join].forEach(/** Clear a modal field error when the field changes. */ (modal) => {
        modal.input.addEventListener('input', /** Clear the edited field's error. */ () => clearModalFieldError(modal.input, modal.error));
    });
    [modalsDom.create, modalsDom.created, modalsDom.join].forEach(/** Wire a modal's close controls. */ (modal) => {
        modal.closeButton.addEventListener('click', /** Close the modal unless it is submitting. */ () => {
            if (!modalState.isSubmitting) closeModal();
        });
        modal.overlay.addEventListener('keydown', trapModalFocus);
        modal.overlay.addEventListener('click', /** Close the modal when clicking its backdrop. */ (event) => {
            if (event.target === modal.overlay && !modalState.isSubmitting) closeModal();
        });
    });
}
