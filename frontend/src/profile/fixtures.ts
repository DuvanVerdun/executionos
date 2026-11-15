import type { FollowingEntry, LiveState, Profile, ProfileData } from '../types/social';

/** A live state of someone who is not working. */
export const IDLE: LiveState = { state: 'not_working', percentage: null, mission: null, worked_seconds: null, target_seconds: null };

/** Make the data of a profile: a streak of 3 days, a week of heatmap in its 26 columns, and some stats. */
export function profileData(overrides: Partial<ProfileData> = {}): ProfileData {
    const states: ProfileData['heatmap']['states'] = Array.from({ length: 182 }, () => 'neutral');
    states[179] = 'work';
    states[180] = 'rest';
    states[181] = 'today';
    return {
        live: IDLE,
        last_activity_at: null,
        streak: { current: 3, best: 8 },
        heatmap: { start_date: '2026-05-18', states },
        stats: { total_time_seconds: 5400, total_sessions: 4, days_worked: 3, average_session_time_seconds: 1350 },
        ...overrides
    };
}

/** Make a profile the user may see. */
export function profile(overrides: Partial<Profile> = {}): Profile {
    return {
        username: 'lucia', is_private: false, relation: 'following', follows_you: false,
        followers_count: 3, following_count: 5, data: profileData(), ...overrides
    };
}

/** Make a person that the user follows. */
export function following(username: string, overrides: Partial<FollowingEntry> = {}): FollowingEntry {
    return { username, streak: 2, live: IDLE, ...overrides };
}
