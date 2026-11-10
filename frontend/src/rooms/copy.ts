import type { TranslationKey } from '../i18n/i18n';
import type { MemberState, RoomMenuAction } from '../types/rooms';

/** The text key of each member state. */
export const MEMBER_STATE_LABELS = {
    working: 'rooms.stateWorking',
    paused: 'rooms.statePaused',
    not_working: 'rooms.stateNotWorking'
} as const satisfies Record<MemberState, TranslationKey>;

/** The text key shown on a room menu row while its action runs. */
export const ROOM_BUSY_LABELS = {
    'copy-link': 'rooms.copying',
    'refresh-link': 'rooms.creatingLink',
    'delete-room': 'rooms.deleting',
    'leave-room': 'rooms.leaving'
} as const satisfies Record<Exclude<RoomMenuAction, 'toggle-missions'>, TranslationKey>;

/** The text key of the error shown when a room menu action fails. */
export const ROOM_ACTION_ERRORS = {
    'toggle-missions': 'rooms.errorToggleMissions',
    'copy-link': 'rooms.copyFailed',
    'refresh-link': 'rooms.errorRefreshLink',
    'delete-room': 'rooms.errorDeleteRoom',
    'leave-room': 'rooms.errorLeaveRoom'
} as const satisfies Record<RoomMenuAction, TranslationKey>;

