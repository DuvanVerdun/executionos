// Calls to the backend rooms and room-session routes.

import { apiFetch } from '../auth/http.js';
import { ROOM_REQUEST_TIMEOUT_MS } from '../config.js';
import { getBrowserTimezone } from '../lib/dates.js';
import { getCurrentScreenName } from '../shared/screens.js';

/** Send a room request with a timeout and the screen to leave if sign-in is lost. */
function roomFetch(path, method, body, currentScreen) {
    return apiFetch({
        path, method, body, currentScreen,
        signal: AbortSignal.timeout(ROOM_REQUEST_TIMEOUT_MS)
    });
}

/** Request the rooms the user belongs to. */
export function fetchRooms(currentScreen = 'rooms') {
    return roomFetch('rooms', 'GET', undefined, currentScreen);
}

/** Request creation of a room. */
export function postRoom(name, currentScreen = 'rooms') {
    return roomFetch('rooms', 'POST', { name }, currentScreen);
}

/** Request to join a room with its link token. */
export function postJoinRoom(linkToken, currentScreen = 'rooms') {
    return roomFetch('rooms/join', 'POST', { linkToken }, currentScreen);
}

/** Request to leave a room. */
export function postLeaveRoom(roomId, currentScreen = 'rooms') {
    return roomFetch(`rooms/${roomId}/leave`, 'POST', undefined, currentScreen);
}

/** Request deletion of a room. */
export function deleteRoom(roomId, currentScreen = 'rooms') {
    return roomFetch(`rooms/${roomId}`, 'DELETE', undefined, currentScreen);
}

/** Request a room's link token. */
export function fetchRoomLink(roomId, currentScreen = 'rooms') {
    return roomFetch(`rooms/${roomId}/link`, 'GET', undefined, currentScreen);
}

/** Request a new link token for a room. */
export function postRefreshRoomLink(roomId, currentScreen = 'rooms') {
    return roomFetch(`rooms/${roomId}/link/refresh`, 'POST', undefined, currentScreen);
}

/** Request a change to whether the user's missions show in a room. */
export function patchRoomMembership(roomId, showMissions, currentScreen = 'rooms') {
    return roomFetch(`rooms/${roomId}/membership`, 'PATCH', { showMissions }, currentScreen);
}

/** Request a room's details, summary, and ranking. */
export function fetchRoomSnapshot(roomId, currentScreen = 'room') {
    return roomFetch(`rooms/${roomId}`, 'GET', undefined, currentScreen);
}

/** Request a page of a room's session history. */
export function fetchRoomSessions(roomId, cursor = null, currentScreen = 'room') {
    const params = new URLSearchParams({ timezone: getBrowserTimezone() });
    if (cursor) {
        params.set('cursor_date', cursor.date);
        params.set('cursor_id', String(cursor.id));
    }
    return roomFetch(`rooms/${roomId}/sessions?${params.toString()}`, 'GET', undefined, currentScreen);
}

/** Request the user's running room session and any pending notice. */
export function fetchRoomSession(currentScreen = getCurrentScreenName()) {
    return roomFetch('room-session', 'GET', undefined, currentScreen);
}

/** Request the start of a room session. */
export function postStartRoomSession(roomId, mission, targetTimeSeconds) {
    return roomFetch('room-session', 'POST', { roomId, mission, targetTimeSeconds }, 'room');
}

/** Send a room session event: pause, resume, checkin, or heartbeat. */
export function postRoomSessionEvent(event) {
    return roomFetch(`room-session/${event}`, 'POST', undefined, getCurrentScreenName());
}

/** Request that the paused room session be saved and ended. */
export function postFinishRoomSession(submissionId) {
    return roomFetch('room-session/finish', 'POST', { submissionId }, 'review');
}

/** Request a room's summary, optionally counting the user's running session. */
export function fetchRoomSummary(roomId, includeMyRunningSession) {
    return roomFetch(
        `rooms/${roomId}/summary?include_my_running_session=${includeMyRunningSession}`,
        'GET', undefined, 'review'
    );
}
