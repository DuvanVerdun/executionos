import type { RoomCard } from '../types/rooms';
import { roomSessionStore } from './room-session-state';
import { roomSnapshotCache, roomStore, roomsStore } from './state';

/** Return the rooms with the name of one room changed. */
function withName(rooms: RoomCard[], roomId: number, name: string): RoomCard[] {
    return rooms.map(/** Change the matching room. */ (room) => (room.id === roomId ? { ...room, name } : room));
}

/** Show a new room name everywhere the room appears: the Rooms cards, the Room screen, and a running room session. The server has already saved it. */
export function showRoomName(roomId: number, name: string): void {
    const { rooms, shownRooms } = roomsStore.get();
    roomsStore.update({ rooms: withName(rooms, roomId, name), shownRooms: withName(shownRooms, roomId, name) });

    const { snapshot } = roomStore.get();
    if (snapshot?.room.id === roomId) {
        roomStore.update({ snapshot: { ...snapshot, room: { ...snapshot.room, name } } });
    }

    const cached = roomSnapshotCache.get(roomId);
    if (cached) roomSnapshotCache.set(roomId, { ...cached, room: { ...cached.room, name } });

    if (roomSessionStore.get().roomId === roomId) roomSessionStore.update({ roomName: name });
}
