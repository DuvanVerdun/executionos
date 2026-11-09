import type { MemberState, RoomMenuAction } from '../types/rooms';

export const MEMBER_STATE_LABELS: Record<MemberState, string> = {
    working: 'Working',
    paused: 'Paused',
    not_working: 'Not working'
};

export const ROOM_BUSY_LABELS: Record<Exclude<RoomMenuAction, 'toggle-missions'>, string> = {
    'copy-link': 'Copying…',
    'refresh-link': 'Creating link…',
    'delete-room': 'Deleting…',
    'leave-room': 'Leaving…'
};

export const ROOM_COPY = {
    showMissionsLabel: 'Show Missions',
    copyLinkLabel: 'Copy link',
    refreshLinkLabel: 'Refresh link',
    deleteRoomLabel: 'Delete room',
    leaveRoomLabel: 'Leave room',
    leaveConfirm: 'Leave this room? You can rejoin only with a valid link.',
    deleteConfirm: 'Delete this room? Its history is removed for everyone. Members keep their sessions in their personal history.',
    refreshConfirm: 'Create a new link? The old link will stop working.',
    linkCopied: 'Link copied.',
    linkRefreshed: 'New link created.',
    copyFailed: "Couldn't copy the link.",
    invalidLink: "This link isn't valid.",
    roomNameRequired: 'Enter a Room name.',
    roomLinkRequired: 'Enter a Room link.',
    createFailed: "Couldn't create the room. Try again.",
    joinFailed: "Couldn't join the room. Try again.",
    serverUnreachable: "Couldn't reach the server. Try again.",
    deleteBusy: 'Someone is working in this room. Try again when they finish.',
    historyFailed: "Couldn't load the room history.",
    moreSessionsFailed: "Couldn't load more sessions.",
    sessionSaved: 'Session saved. Nice work.',
    sessionEndedGeneric: 'Your session ended while you were away.',
    finishFailed: "Couldn't finish saving. Your work is still here. Try again.",
    sessionErrors: {
        start: "Couldn't start the session. Try again.",
        pause: "Couldn't pause. Try again.",
        resume: "Couldn't resume. Try again.",
        stop: "Couldn't stop. Try again.",
        continue: "Couldn't continue. Try again.",
        checkin: "Couldn't confirm. Try again."
    },
    actionErrors: {
        'toggle-missions': "Couldn't update this setting. Try again.",
        'copy-link': "Couldn't copy the link.",
        'refresh-link': "Couldn't create a new link. Try again.",
        'delete-room': "Couldn't delete the room. Try again.",
        'leave-room': "Couldn't leave the room. Try again."
    }
};
