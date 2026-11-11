import { t } from '../i18n/i18n';
import { errorStatus } from '../lib/errors';
import { confirmAction } from '../shared/confirm';
import { setFloatingMessage } from '../shared/floating-message';
import type { RoomMenuAction, RoomMenuHooks, RoomMenuRoom } from '../types/rooms';
import { deleteRoom, fetchRoomLink, patchRoomMembership, postLeaveRoom, postRefreshRoomLink } from './api';
import { ROOM_ACTION_ERRORS } from './copy';
import { buildRoomLink } from './links';

/** Ask the user to confirm an action that is hard to undo. Return true at once for the actions that need no question. */
function isConfirmed(action: RoomMenuAction): Promise<boolean> {
    if (action === 'refresh-link') {
        return confirmAction({ message: t('rooms.refreshConfirm'), confirmLabel: t('rooms.refreshLink') });
    }
    if (action === 'delete-room') {
        return confirmAction({ message: t('rooms.deleteConfirm'), confirmLabel: t('rooms.deleteRoom') });
    }
    if (action === 'leave-room') {
        return confirmAction({ message: t('rooms.leaveConfirm'), confirmLabel: t('rooms.leaveRoom') });
    }
    return Promise.resolve(true);
}

/** Run one room menu action for either menu. The hooks say how each screen reacts. */
export async function runRoomMenuAction(action: RoomMenuAction, room: RoomMenuRoom, hooks: RoomMenuHooks): Promise<void> {
    if (hooks.isBusy()) return;
    if (!await isConfirmed(action)) return;
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
            setFloatingMessage(t('rooms.linkCopied'));
        } else if (action === 'refresh-link') {
            const result = await postRefreshRoomLink(room.id, hooks.screen);
            if (!result.success) throw new Error(result.error);
            setFloatingMessage(t('rooms.linkRefreshed'));
        } else if (action === 'delete-room') {
            const result = await deleteRoom(room.id, hooks.screen);
            if (result.status === 409) {
                setFloatingMessage(t('rooms.deleteBusy'), { error: true });
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
        setFloatingMessage(t(ROOM_ACTION_ERRORS[action]), { error: true });
    } finally {
        hooks.setBusy(null);
        if (roomRemoved) await hooks.onRemoved();
    }
}
