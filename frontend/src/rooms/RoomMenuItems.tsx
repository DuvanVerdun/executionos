import { useT } from '../i18n/i18n';
import type { RoomMenuAction, RoomMenuRoom } from '../types/rooms';
import { ROOM_BUSY_LABELS } from './copy';

type RowAction = Exclude<RoomMenuAction, 'toggle-missions'>;

interface RoomMenuItemsProps {
    room: RoomMenuRoom;
    busyAction: RoomMenuAction | null;
    onAction: (action: RoomMenuAction) => void;
}

/** Draw one action row of a room menu. */
function MenuRow({ action, label, busyAction, onAction }: {
    action: RowAction;
    label: string;
    busyAction: RoomMenuAction | null;
    onAction: (action: RoomMenuAction) => void;
}) {
    const t = useT();
    return (
        <button
            type="button"
            className="room-menu-item"
            data-action={action}
            role="menuitem"
            disabled={busyAction !== null}
            onClick={() => { onAction(action); }}
        >
            {busyAction === action ? t(ROOM_BUSY_LABELS[action]) : label}
        </button>
    );
}

/** Fill a room menu with the rows this user's role allows. */
export function RoomMenuItems({ room, busyAction, onAction }: RoomMenuItemsProps) {
    const t = useT();
    const rowBusyAction = busyAction === 'toggle-missions' ? null : busyAction;
    return (
        <>
            <div className="room-menu-item room-menu-switch-row">
                <span>{t('rooms.showMissions')}</span>
                <button
                    type="button"
                    className="room-switch"
                    data-action="toggle-missions"
                    role="switch"
                    aria-label={t('rooms.showMissions')}
                    aria-checked={room.show_missions}
                    disabled={busyAction !== null && busyAction !== 'toggle-missions'}
                    onClick={() => { onAction('toggle-missions'); }}
                >
                    <span className="room-switch-knob"></span>
                </button>
            </div>
            {room.is_owner && (
                <>
                    <MenuRow action="copy-link" label={t('rooms.copyLink')} busyAction={rowBusyAction} onAction={onAction} />
                    <MenuRow action="refresh-link" label={t('rooms.refreshLink')} busyAction={rowBusyAction} onAction={onAction} />
                    <MenuRow action="delete-room" label={t('rooms.deleteRoom')} busyAction={rowBusyAction} onAction={onAction} />
                </>
            )}
            <MenuRow action="leave-room" label={t('rooms.leaveRoom')} busyAction={rowBusyAction} onAction={onAction} />
        </>
    );
}
