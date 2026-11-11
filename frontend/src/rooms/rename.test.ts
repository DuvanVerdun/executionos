import { describe, expect, it } from 'vitest';
import type { RoomCard, RoomSnapshot } from '../types/rooms';
import { showRoomName } from './rename';
import { roomSessionStore } from './room-session-state';
import { roomSnapshotCache, roomStore, roomsStore } from './state';

/** Make a room card with the given ID and name. */
function card(id: number, name: string): RoomCard {
    return { id, name, members_count: 2, my_total_time_seconds: 0, working_now_count: 0, is_owner: true, show_missions: true };
}

/** Make a snapshot of a room with the given ID and name. */
function snapshot(id: number, name: string): RoomSnapshot {
    return {
        room: { id, name, is_owner: true, show_missions: true },
        summary: { total_time_seconds: 0, total_sessions: 0, members_count: 2, average_session_time_seconds: null },
        ranking: []
    };
}

describe('showRoomName', () => {
    it('renames the room in the Rooms list, and leaves the other rooms alone', () => {
        roomsStore.update({ rooms: [card(1, 'One'), card(2, 'Two')], shownRooms: [card(1, 'One'), card(2, 'Two')] });
        showRoomName(2, 'Renamed');
        expect(roomsStore.get().rooms.map(/** Read the name of a room. */ (room) => room.name)).toEqual(['One', 'Renamed']);
        expect(roomsStore.get().shownRooms.map(/** Read the name of a room. */ (room) => room.name)).toEqual(['One', 'Renamed']);
    });

    it('renames the room on the Room screen and in the cache that the screen starts from', () => {
        roomStore.update({ roomId: 2, snapshot: snapshot(2, 'Two') });
        roomSnapshotCache.set(2, snapshot(2, 'Two'));
        showRoomName(2, 'Renamed');
        expect(roomStore.get().snapshot?.room.name).toBe('Renamed');
        expect(roomSnapshotCache.get(2)?.room.name).toBe('Renamed');
    });

    it('does not rename another room that is open', () => {
        roomStore.update({ roomId: 1, snapshot: snapshot(1, 'One') });
        showRoomName(2, 'Renamed');
        expect(roomStore.get().snapshot?.room.name).toBe('One');
    });

    it('renames the room that a running session is in, for the Focus and Review screens', () => {
        roomSessionStore.update({ active: true, roomId: 2, roomName: 'Two' });
        showRoomName(2, 'Renamed');
        expect(roomSessionStore.get().roomName).toBe('Renamed');
    });

    it('does not rename the room of a running session in another room', () => {
        roomSessionStore.update({ active: true, roomId: 1, roomName: 'One' });
        showRoomName(2, 'Renamed');
        expect(roomSessionStore.get().roomName).toBe('One');
    });
});
