// Rooms and room sessions, as the backend sends them.

import type { ApiFailure } from './api';
import type { ScreenName } from './screens';
import type { DailySummary, HistoryCursor, HistorySession } from './session';

export type MemberState = 'working' | 'paused' | 'not_working';

/** A room as listed on the Rooms screen. */
export interface RoomCard {
    id: number;
    name: string;
    members_count: number;
    my_total_time_seconds: number;
    working_now_count: number;
    is_owner: boolean;
    show_missions: boolean;
}

export interface RoomSummary {
    total_time_seconds: number;
    total_sessions: number;
    members_count: number;
    average_session_time_seconds: number | null;
}

export interface RankingEntry {
    position: number;
    username: string;
    is_you: boolean;
    is_owner: boolean;
    state: MemberState;
    ring_percentage: number | null;
    total_time_seconds: number;
    sessions_count: number;
}

export interface RoomSnapshot {
    room: {
        id: number;
        name: string;
        is_owner: boolean;
        show_missions: boolean;
    };
    summary: RoomSummary;
    ranking: RankingEntry[];
}

/** A session in a room's history. The mission is null when its owner hides missions. */
export interface RoomHistorySession extends Omit<HistorySession, 'mission'> {
    mission: string | null;
    mission_hidden: boolean;
    username: string;
    is_mine: boolean;
    is_former_member: boolean;
}

export interface RoomHistoryPage {
    sessions: RoomHistorySession[];
    daily_summaries: Record<string, DailySummary>;
    next_cursor: HistoryCursor | null;
}

export type SessionEndReason = 'disconnected' | 'missed_checkin' | 'paused_timeout';

/** Why a room session ended without the user. */
export interface RoomSessionNotice {
    reason: SessionEndReason;
    saved: boolean;
    actual_time_seconds: number;
}

/** The running room session, as the server holds it. */
export interface RoomSessionPayload {
    submission_id: string;
    room_id: number;
    room_name: string;
    mission: string;
    target_time_seconds: number;
    started_at: string;
    paused_at: string | null;
    paused_seconds: number;
    actual_time_seconds: number;
    state: 'running' | 'paused';
    checkin: {
        mark: number;
        due_at: string | null;
        deadline_at: string | null;
        outstanding: boolean;
    };
}

/**
 * What every room-session route answers. `success` is false when the server reports a conflict (409):
 * the envelope is still complete then, so the client can catch up with it.
 */
export interface RoomSessionEnvelope {
    success: boolean;
    error?: string;
    server_time: string;
    active: boolean;
    session: RoomSessionPayload | null;
    notice: RoomSessionNotice | null;
    /** Only on Finish. */
    saved?: boolean;
    session_id?: number | null;
    status: number;
}

/** A room-session route answers with an envelope, or with a plain failure (no `server_time`). */
export type RoomSessionResult = RoomSessionEnvelope | ApiFailure;

/** The actions of a room menu. */
export type RoomMenuAction = 'toggle-missions' | 'copy-link' | 'refresh-link' | 'delete-room' | 'leave-room';

/** Report whether a string is a room menu action. */
export function isRoomMenuAction(value: string | undefined): value is RoomMenuAction {
    return value === 'toggle-missions' || value === 'copy-link' || value === 'refresh-link'
        || value === 'delete-room' || value === 'leave-room';
}

/** The part of a room that its menu reads and changes. */
export type RoomMenuRoom = Pick<RoomCard, 'id' | 'is_owner' | 'show_missions'>;

/** What each screen tells the room menu: how to mark work as running, and what to do after a room is removed. */
export interface RoomMenuHooks {
    screen: ScreenName;
    isBusy(): boolean;
    setBusy(action: RoomMenuAction | null): void;
    onRemoved(): Promise<void>;
}

/** Which part of the room history failed to load. */
export type HistoryFailure = 'first' | 'more';
