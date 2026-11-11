import { describe, expect, it } from 'vitest';
import type { RoomHistorySession } from '../types/rooms';
import { setRoomSessionMission } from './room';
import { roomStore } from './state';

/** Make a session of the room history with the given ID and mission. */
function roomSession(id: number, mission: string | null): RoomHistorySession {
    return {
        id, date: '2026-11-09T12:00:00', mission, mission_hidden: mission === null, username: 'ana', is_mine: true,
        is_former_member: false, target_time_seconds: 600, actual_time_seconds: 600, percentage_completed: 100,
        completion_status: 'completed'
    };
}

describe('changing a mission in the room history', () => {
    it('changes only the session that matches', () => {
        roomStore.update({ sessions: [roomSession(1, 'one'), roomSession(2, 'two'), roomSession(3, null)] });
        setRoomSessionMission(2, 'new');
        expect(roomStore.get().sessions.map(/** Read the mission of a session. */ (item) => item.mission)).toEqual(['one', 'new', null]);
    });
});
