// Calls to the backend rooms and room-session routes.

import { apiFetch } from '../auth/http';
import { ROOM_REQUEST_TIMEOUT_MS } from '../config';
import { getBrowserTimezone } from '../lib/dates';
import { getCurrentScreenName } from '../shared/screens';
import type { ApiResult, HttpMethod } from '../types/api';
import type {
    RoomCard, RoomHistoryPage, RoomSessionResult, RoomSnapshot, RoomSummary
} from '../types/rooms';
import type { ScreenName } from '../types/screens';
import type { HistoryCursor } from '../types/session';

/** Send a room request with a timeout and the screen to leave if sign-in is lost. */
function roomFetch<R extends { status: number }>(path: string, method: HttpMethod, body: unknown, currentScreen: ScreenName): Promise<R> {
    return apiFetch<R>({
        path, method, body, currentScreen,
        signal: AbortSignal.timeout(ROOM_REQUEST_TIMEOUT_MS)
    });
}

/** Request the rooms the user belongs to. */
export function fetchRooms(currentScreen: ScreenName = 'rooms'): Promise<ApiResult<{ rooms: RoomCard[] }>> {
    return roomFetch<ApiResult<{ rooms: RoomCard[] }>>('rooms', 'GET', undefined, currentScreen);
}

/** Request creation of a room. */
export function postRoom(name: string, currentScreen: ScreenName = 'rooms'): Promise<ApiResult<{ room: RoomCard & { link_token: string } }>> {
    return roomFetch<ApiResult<{ room: RoomCard & { link_token: string } }>>('rooms', 'POST', { name }, currentScreen);
}

/** Request to join a room with its link token. */
export function postJoinRoom(linkToken: string, currentScreen: ScreenName = 'rooms'): Promise<ApiResult<{ room: RoomCard; already_member: boolean }>> {
    return roomFetch<ApiResult<{ room: RoomCard; already_member: boolean }>>('rooms/join', 'POST', { linkToken }, currentScreen);
}

/** Request to leave a room. */
export function postLeaveRoom(roomId: number, currentScreen: ScreenName = 'rooms'): Promise<ApiResult<{ room_deleted: boolean }>> {
    return roomFetch<ApiResult<{ room_deleted: boolean }>>(`rooms/${roomId}/leave`, 'POST', undefined, currentScreen);
}

/** Request deletion of a room. */
export function deleteRoom(roomId: number, currentScreen: ScreenName = 'rooms'): Promise<ApiResult<object>> {
    return roomFetch<ApiResult<object>>(`rooms/${roomId}`, 'DELETE', undefined, currentScreen);
}

/** Request a room's link token. */
export function fetchRoomLink(roomId: number, currentScreen: ScreenName = 'rooms'): Promise<ApiResult<{ link_token: string }>> {
    return roomFetch<ApiResult<{ link_token: string }>>(`rooms/${roomId}/link`, 'GET', undefined, currentScreen);
}

/** Request a new link token for a room. */
export function postRefreshRoomLink(roomId: number, currentScreen: ScreenName = 'rooms'): Promise<ApiResult<{ link_token: string }>> {
    return roomFetch<ApiResult<{ link_token: string }>>(`rooms/${roomId}/link/refresh`, 'POST', undefined, currentScreen);
}

/** Request a change to whether the user's missions show in a room. */
export function patchRoomMembership(roomId: number, showMissions: boolean, currentScreen: ScreenName = 'rooms'): Promise<ApiResult<{ show_missions: boolean }>> {
    return roomFetch<ApiResult<{ show_missions: boolean }>>(`rooms/${roomId}/membership`, 'PATCH', { showMissions }, currentScreen);
}

/** Request a room's details, summary, and ranking. */
export function fetchRoomSnapshot(roomId: number, currentScreen: ScreenName = 'room'): Promise<ApiResult<RoomSnapshot>> {
    return roomFetch<ApiResult<RoomSnapshot>>(`rooms/${roomId}`, 'GET', undefined, currentScreen);
}

/** Request a page of a room's session history. */
export function fetchRoomSessions(roomId: number, cursor: HistoryCursor | null = null, currentScreen: ScreenName = 'room'): Promise<ApiResult<RoomHistoryPage>> {
    const params = new URLSearchParams({ timezone: getBrowserTimezone() });
    if (cursor) {
        params.set('cursor_date', cursor.date);
        params.set('cursor_id', String(cursor.id));
    }
    return roomFetch<ApiResult<RoomHistoryPage>>(`rooms/${roomId}/sessions?${params.toString()}`, 'GET', undefined, currentScreen);
}

/** Request the user's running room session and any pending notice. */
export function fetchRoomSession(currentScreen: ScreenName = getCurrentScreenName()): Promise<RoomSessionResult> {
    return roomFetch<RoomSessionResult>('room-session', 'GET', undefined, currentScreen);
}

/** Request the start of a room session. */
export function postStartRoomSession(roomId: number, mission: string, targetTimeSeconds: number): Promise<RoomSessionResult> {
    return roomFetch<RoomSessionResult>('room-session', 'POST', { roomId, mission, targetTimeSeconds }, 'room');
}

/** Send a room session event: pause, resume, checkin, or heartbeat. */
export function postRoomSessionEvent(event: 'pause' | 'resume' | 'checkin' | 'heartbeat'): Promise<RoomSessionResult> {
    return roomFetch<RoomSessionResult>(`room-session/${event}`, 'POST', undefined, getCurrentScreenName());
}

/** Request that the paused room session be saved and ended. */
export function postFinishRoomSession(submissionId: string): Promise<RoomSessionResult> {
    return roomFetch<RoomSessionResult>('room-session/finish', 'POST', { submissionId }, 'review');
}

/** Request a room's summary, optionally counting the user's running session. */
export function fetchRoomSummary(roomId: number, includeMyRunningSession: boolean): Promise<ApiResult<{ summary: RoomSummary }>> {
    return roomFetch<ApiResult<{ summary: RoomSummary }>>(
        `rooms/${roomId}/summary?include_my_running_session=${includeMyRunningSession}`,
        'GET', undefined, 'review'
    );
}
