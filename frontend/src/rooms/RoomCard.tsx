import { useT } from '../i18n/i18n';
import { formatDurationHoursMinutes } from '../lib/durations';
import type { RoomCard as RoomCardData } from '../types/rooms';
import { RoomMenuItems } from './RoomMenuItems';
import { openRoom } from './room';
import { roomsMenuHooks, setRoomMenuOpen } from './rooms';
import { runRoomMenuAction } from './menu';
import { useStore } from '../lib/store';
import { roomsStore } from './state';

/** Draw a room card with its menu button and its menu. */
export function RoomCard({ room }: { room: RoomCardData }) {
    const t = useT();
    const { openMenuRoomId, busyAction } = useStore(roomsStore);
    const isOpen = openMenuRoomId === room.id;

    return (
        <article
            className="room-card"
            data-room-id={room.id}
            onClick={(event) => {
                if (event.target instanceof Element && event.target.closest('.room-menu-wrapper')) return;
                void openRoom(room.id, 'rooms');
            }}
        >
            <div className="room-card-header">
                <div>
                    <p className="room-card-name">{room.name}</p>
                    <p className="room-card-members">{room.members_count === 1 ? t('rooms.membersOne') : t('rooms.membersOther', { count: room.members_count })}</p>
                </div>
                <div className="room-menu-wrapper">
                    <button
                        type="button"
                        className="room-menu-toggle"
                        data-action="toggle-menu"
                        aria-label={t('rooms.openMenu', { name: room.name })}
                        aria-haspopup="menu"
                        aria-expanded={isOpen}
                        onClick={() => { setRoomMenuOpen(isOpen ? null : room.id); }}
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
                    </button>
                    <div className="room-menu" role="menu" hidden={!isOpen}>
                        {isOpen && (
                            <RoomMenuItems
                                room={room}
                                busyAction={busyAction}
                                onAction={(action) => { void runRoomMenuAction(action, room, roomsMenuHooks); }}
                            />
                        )}
                    </div>
                </div>
            </div>
            <div>
                <p className="room-card-total">{formatDurationHoursMinutes(room.my_total_time_seconds)}</p>
                <p className="room-card-total-label">{t('rooms.yourTotal')}</p>
            </div>
            <p className="room-card-status">
                <span className={room.working_now_count > 0 ? 'room-card-status-dot is-active' : 'room-card-status-dot'}></span>
                <span>{t('rooms.workingNow', { count: room.working_now_count })}</span>
            </p>
        </article>
    );
}
