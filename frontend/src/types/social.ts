import type { MemberState } from './rooms';
import type { CalendarState } from './dashboard';

/** What the server tells about a user's session. Everything but the state is null while the user is not working. */
export interface LiveState {
    state: MemberState;
    percentage: number | null;
    mission: string | null;
    worked_seconds: number | null;
    target_seconds: number | null;
}

/** How the user who asks relates to a profile. */
export type Relation = 'self' | 'none' | 'following' | 'requested';

/** The data of a profile that only its owner and its followers see. */
export interface ProfileData {
    live: LiveState;
    last_activity_at: string | null;
    streak: { current: number; best: number };
    heatmap: {
        /** The Monday of the first week, as YYYY-MM-DD. */
        start_date: string;
        /** One state for each day, from the first day on, 26 weeks of 7 days. */
        states: CalendarState[];
    };
    stats: {
        total_time_seconds: number;
        total_sessions: number;
        days_worked: number;
        average_session_time_seconds: number | null;
    };
}

export interface Profile {
    username: string;
    is_private: boolean;
    relation: Relation;
    follows_you: boolean;
    followers_count: number;
    following_count: number;
    /** Null when the user who asks may not see it. */
    data: ProfileData | null;
}

/** A person the user follows, as the list shows them. */
export interface FollowingEntry {
    username: string;
    streak: number;
    live: LiveState;
}

export interface FollowRequest {
    username: string;
}

export interface FollowingList {
    requests: FollowRequest[];
    following: FollowingEntry[];
}

/** A user found by the search, and how the user who asks relates to them. */
export interface SearchUser {
    username: string;
    is_private: boolean;
    relation: Exclude<Relation, 'self'>;
}

/** The settings of the account. */
export interface Account {
    username: string;
    is_private: boolean;
    /** When the username can be changed again, or null when it can be changed now. */
    username_next_change_at: string | null;
}

export interface BlockedUser {
    username: string;
}

/** What a client tells the server about its running session. */
export interface PresenceReport {
    state: 'working' | 'paused';
    mission: string;
    workedSeconds: number;
    targetSeconds: number;
}
