import { ROOM_POLL_INTERVAL_MS } from '../config';
import { loadStreak } from '../streak/streak';
import type { RoomCard, RoomMenuHooks } from '../types/rooms';
import { fetchRooms } from './api';
import { roomsStore, type RoomsSurface } from './state';

/** Grows with every load and every screen exit, so older results can be ignored. */
let loadGeneration = 0;

let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Show one Rooms surface (loading, rooms, empty, or error) and hide the others. */
function showRoomsSurface(surface: RoomsSurface): void {
    roomsStore.update({ surface });
}

/** Show the latest rooms, or the empty state when the user has no rooms. A menu that is open keeps the list as it is. */
function renderRooms(): void {
    const state = roomsStore.get();
    if (state.openMenuRoomId !== null) {
        roomsStore.update({ renderDeferred: true });
        return;
    }
    roomsStore.update({
        renderDeferred: false,
        shownRooms: state.rooms,
        surface: state.rooms.length > 0 ? 'rooms' : 'empty'
    });
}

/** Return the rooms with one room's show-missions setting changed. */
function withShowMissions(rooms: RoomCard[], roomId: number, value: boolean): RoomCard[] {
    return rooms.map(/** Change the matching room. */ (room) => (room.id === roomId ? { ...room, show_missions: value } : room));
}

/** Open the menu of one room, or close every menu when no room is given. */
export function setRoomMenuOpen(roomId: number | null): void {
    roomsStore.update({ openMenuRoomId: roomId });
    if (roomId === null && roomsStore.get().renderDeferred) renderRooms();
}

/** Load the user's rooms. A silent load keeps what is on screen while it runs. */
export async function loadRooms({ silent = false, surfaceErrors = !silent }: { silent?: boolean; surfaceErrors?: boolean } = {}): Promise<void> {
    const generation = ++loadGeneration;
    roomsStore.update({ isLoading: true });
    if (!silent && !roomsStore.get().hasLoaded) showRoomsSurface('loading');
    try {
        const result = await fetchRooms();
        if (generation !== loadGeneration) return;
        if (!result.success) throw new Error(result.error);
        roomsStore.update({ rooms: result.rooms, hasLoaded: true });
        renderRooms();
    } catch (error) {
        if (generation !== loadGeneration) return;
        console.error('Rooms loading error:', error);
        if (surfaceErrors || !roomsStore.get().hasLoaded) showRoomsSurface('error');
    } finally {
        if (generation === loadGeneration) roomsStore.update({ isLoading: false });
    }
}

/** Refresh the rooms on a timer, skipping hidden tabs and overlapping requests. */
export async function pollRooms(): Promise<void> {
    if (document.hidden || roomsStore.get().isLoading) return;
    await loadRooms({ silent: true });
}

/** Whether the rooms are being polled now. */
export function isPollingRooms(): boolean {
    return pollTimer !== null;
}

/** Start polling the rooms every 15 seconds. */
function startRoomsPolling(): void {
    stopRoomsPolling();
    pollTimer = setInterval(pollRooms, ROOM_POLL_INTERVAL_MS);
}

/** Stop polling the rooms. */
function stopRoomsPolling(): void {
    clearInterval(pollTimer ?? undefined);
    pollTimer = null;
}

/** Stop everything the Rooms screen started. */
export function leaveRoomsScreen(): void {
    stopRoomsPolling();
    loadGeneration += 1;
    roomsStore.update({ isLoading: false, openMenuRoomId: null, renderDeferred: false });
}

/** Prepare the Rooms screen after it is shown, and load its rooms. */
export async function enterRoomsScreen(): Promise<void> {
    roomsStore.update({ openMenuRoomId: null });
    if (roomsStore.get().hasLoaded) renderRooms();
    startRoomsPolling();
    void loadStreak('rooms');
    await loadRooms();
}

/** Reload the rooms after a failed first load. */
export async function retryRooms(): Promise<void> {
    roomsStore.update({ hasLoaded: false });
    await loadRooms();
}

/** Forget the rooms the user had. Used when the user signs out or reaches Login. */
export function resetRoomsData(): void {
    roomsStore.update({ hasLoaded: false, rooms: [] });
}

/** What the Rooms screen tells the room menu. */
export const roomsMenuHooks: RoomMenuHooks = {
    screen: 'rooms',
    /** Report whether a Rooms menu action is running. */
    isBusy: () => roomsStore.get().busyAction !== null,
    /** Record the running Rooms menu action. */
    setBusy(action) {
        roomsStore.update({ busyAction: action });
    },
    /** Change the show-missions setting of a room, on screen and in the latest list. */
    setShowMissions(roomId, value) {
        const state = roomsStore.get();
        roomsStore.update({
            rooms: withShowMissions(state.rooms, roomId, value),
            shownRooms: withShowMissions(state.shownRooms, roomId, value)
        });
    },
    /** Close the menu and reload the rooms after a room is left or deleted. */
    async onRemoved() {
        setRoomMenuOpen(null);
        await loadRooms({ silent: true });
    }
};
