import { errorStatus } from '../lib/errors';
import { setFloatingMessage } from '../shared/floating-message';
import type { RoomMenuAction, RoomMenuHooks, RoomMenuRoom } from '../types/rooms';
import { deleteRoom, fetchRoomLink, patchRoomMembership, postLeaveRoom, postRefreshRoomLink } from './api';
import { ROOM_COPY } from './copy';
import { buildRoomLink } from './links';

/** Run one room menu action for either menu. The hooks say how each screen reacts. */
export async function runRoomMenuAction(action: RoomMenuAction, room: RoomMenuRoom, hooks: RoomMenuHooks): Promise<void> {
    if (hooks.isBusy()) return;
    if (action === 'refresh-link' && !confirm(ROOM_COPY.refreshConfirm)) return;
    if (action === 'delete-room' && !confirm(ROOM_COPY.deleteConfirm)) return;
    if (action === 'leave-room' && !confirm(ROOM_COPY.leaveConfirm)) return;
    const previousShowMissions = room.show_missions;
    if (action === 'toggle-missions') hooks.setShowMissions(room.id, !previousShowMissions);
    hooks.setBusy(action);
    let roomRemoved = false;
    try {
        if (action === 'toggle-missions') {
            const result = await patchRoomMembership(room.id, !previousShowMissions, hooks.screen);
            if (!result.success) throw new Error(result.error);
            hooks.setShowMissions(room.id, result.show_missions);
        } else if (action === 'copy-link') {
            const result = await fetchRoomLink(room.id, hooks.screen);
            if (!result.success) throw new Error(result.error);
            await navigator.clipboard.writeText(buildRoomLink(result.link_token));
            setFloatingMessage(ROOM_COPY.linkCopied);
        } else if (action === 'refresh-link') {
            const result = await postRefreshRoomLink(room.id, hooks.screen);
            if (!result.success) throw new Error(result.error);
            setFloatingMessage(ROOM_COPY.linkRefreshed);
        } else if (action === 'delete-room') {
            const result = await deleteRoom(room.id, hooks.screen);
            if (result.status === 409) {
                setFloatingMessage(ROOM_COPY.deleteBusy, { error: true });
                return;
            }
            if (!result.success) throw new Error(result.error);
            roomRemoved = true;
        } else {
            const result = await postLeaveRoom(room.id, hooks.screen);
            if (!result.success) throw new Error(result.error);
            roomRemoved = true;
        }
    } catch (error) {
        if (action === 'toggle-missions') hooks.setShowMissions(room.id, previousShowMissions);
        if (errorStatus(error) === 401) return;
        console.error(`Room action "${action}" failed:`, error);
        setFloatingMessage(ROOM_COPY.actionErrors[action], { error: true });
    } finally {
        hooks.setBusy(null);
        if (roomRemoved) await hooks.onRemoved();
    }
}
