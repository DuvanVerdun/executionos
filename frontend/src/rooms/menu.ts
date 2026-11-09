// The room menu (Rooms cards and Room top bar).

import { setFloatingMessage } from '../shared/floating-message';
import { deleteRoom, fetchRoomLink, patchRoomMembership, postLeaveRoom, postRefreshRoomLink } from './api';
import { ROOM_BUSY_LABELS, ROOM_COPY } from './copy';
import { buildRoomLink } from './links';
import { errorStatus } from '../lib/errors';
import { getElement } from '../lib/dom';
import type { RoomMenuAction, RoomMenuHooks, RoomMenuRoom } from '../types/rooms';

/** The actions that are plain buttons in the menu. The show-missions switch is separate. */
type RowAction = Exclude<RoomMenuAction, 'toggle-missions'>;

/** Create one action row for a room menu. */
function createRoomMenuRow(action: RowAction, label: string, busyAction: RoomMenuAction | null): HTMLButtonElement {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'room-menu-item';
    row.dataset.action = action;
    row.setAttribute('role', 'menuitem');
    row.disabled = busyAction !== null;
    row.textContent = busyAction === action ? ROOM_BUSY_LABELS[action] : label;
    return row;
}

/** Create the show-missions row. Only its switch is a control. */
function createRoomMenuSwitchRow(): HTMLDivElement {
    const row = document.createElement('div');
    const label = document.createElement('span');
    const toggle = document.createElement('button');
    const knob = document.createElement('span');

    row.className = 'room-menu-item room-menu-switch-row';
    toggle.type = 'button';
    toggle.className = 'room-switch';
    toggle.dataset.action = 'toggle-missions';
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-label', ROOM_COPY.showMissionsLabel);
    knob.className = 'room-switch-knob';
    label.textContent = ROOM_COPY.showMissionsLabel;

    toggle.appendChild(knob);
    row.append(label, toggle);
    return row;
}

/** Update the switch in place, so its change animates. */
function updateRoomMenuSwitch(row: HTMLElement, room: RoomMenuRoom, busyAction: RoomMenuAction | null): void {
    const toggle = getElement('.room-switch', HTMLButtonElement, row);
    toggle.setAttribute('aria-checked', String(room.show_missions));
    toggle.disabled = busyAction !== null && busyAction !== 'toggle-missions';
}

/** Fill a room menu with the rows this user's role allows. The switch row is reused, never rebuilt. */
export function renderRoomMenu(menu: HTMLElement, room: RoomMenuRoom, busyAction: RoomMenuAction | null): void {
    const existingSwitchRow = menu.querySelector('.room-menu-switch-row');
    const switchRow = existingSwitchRow instanceof HTMLElement ? existingSwitchRow : createRoomMenuSwitchRow();
    updateRoomMenuSwitch(switchRow, room, busyAction);
    const rowBusyAction = busyAction === 'toggle-missions' ? null : busyAction;
    const rows: HTMLElement[] = [switchRow];
    if (room.is_owner) {
        rows.push(
            createRoomMenuRow('copy-link', ROOM_COPY.copyLinkLabel, rowBusyAction),
            createRoomMenuRow('refresh-link', ROOM_COPY.refreshLinkLabel, rowBusyAction),
            createRoomMenuRow('delete-room', ROOM_COPY.deleteRoomLabel, rowBusyAction)
        );
    }
    rows.push(createRoomMenuRow('leave-room', ROOM_COPY.leaveRoomLabel, rowBusyAction));
    menu.replaceChildren(...rows);
}

/** Run one room menu action for either menu. The hooks say how each screen reacts. */
export async function runRoomMenuAction(action: RoomMenuAction, room: RoomMenuRoom, hooks: RoomMenuHooks): Promise<void> {
    if (hooks.isBusy()) return;
    if (action === 'refresh-link' && !confirm(ROOM_COPY.refreshConfirm)) return;
    if (action === 'delete-room' && !confirm(ROOM_COPY.deleteConfirm)) return;
    if (action === 'leave-room' && !confirm(ROOM_COPY.leaveConfirm)) return;

    const previousShowMissions = room.show_missions;
    if (action === 'toggle-missions') room.show_missions = !previousShowMissions;
    hooks.setBusy(action);
    let roomRemoved = false;
    try {
        if (action === 'toggle-missions') {
            const result = await patchRoomMembership(room.id, room.show_missions, hooks.screen);
            if (!result.success) throw new Error(result.error);
            room.show_missions = result.show_missions;
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
        } else if (action === 'leave-room') {
            const result = await postLeaveRoom(room.id, hooks.screen);
            if (!result.success) throw new Error(result.error);
            roomRemoved = true;
        }
    } catch (error) {
        if (action === 'toggle-missions') room.show_missions = previousShowMissions;
        if (errorStatus(error) === 401) return;
        console.error(`Room action "${action}" failed:`, error);
        setFloatingMessage(ROOM_COPY.actionErrors[action], { error: true });
    } finally {
        hooks.setBusy(null);
        if (roomRemoved) await hooks.onRemoved();
    }
}
