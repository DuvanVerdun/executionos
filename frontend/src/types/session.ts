export type CompletionStatus = 'completed' | 'partial';

/** The personal session being worked on now (Plan, Focus, Review). */
export interface ActiveSession {
    currentMission: string;
    targetTimeSeconds: number;
    actualTimeSeconds: number;
    completionStatus: CompletionStatus;
    percentageCompleted: number;
    isTimerRunning: boolean;
    /** ISO time, or '' before the session starts. */
    startTimestamp: string;
    /** ISO time, or '' while the timer runs. */
    pauseStartTimestamp: string;
    pausedTimeSeconds: number;
}

/** The part of a session the Focus and Review screens draw. Room sessions use it too. */
export type DisplaySession = Pick<
    ActiveSession,
    'currentMission' | 'targetTimeSeconds' | 'actualTimeSeconds' | 'completionStatus' | 'percentageCompleted'
>;

/** A finished session, exactly as it is sent to the server and kept in the offline queue. */
export interface SessionSubmission {
    submissionId: string;
    date: string;
    mission: string;
    targetTimeSeconds: number;
    actualTimeSeconds: number;
}

/** The active session as saved in this browser (localStorage). */
export interface StoredActiveSession {
    mission: string;
    targetTimeSeconds: number;
    actualTimeSeconds: number;
    startTimestamp: string;
    pauseStartTimestamp: string;
    pausedTimeSeconds: number;
    userId: number | null;
    pendingSubmission: SessionSubmission | null;
}

/** A saved session in a history list. */
export interface HistorySession {
    id: number;
    /** UTC time without a Z. */
    date: string;
    mission: string;
    target_time_seconds: number;
    actual_time_seconds: number;
    percentage_completed: number;
    completion_status: CompletionStatus;
}

export interface DailySummary {
    total_sessions: number;
    total_time_seconds: number;
    average_completion_percentage: number;
    average_session_time_seconds: number;
}

/** Where the next page of a history list starts. */
export interface HistoryCursor {
    date: string;
    id: number;
}

/** One page of the user's own history. */
export interface HistoryPage {
    sessions: HistorySession[];
    daily_summaries: Record<string, DailySummary>;
    next_cursor: HistoryCursor | null;
}
