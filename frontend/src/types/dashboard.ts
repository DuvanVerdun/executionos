export type DashboardPeriod = 'week' | 'month' | 'year' | 'all_time';

export type DashboardMetric = 'time' | 'sessions' | 'completion';

export interface TrendBucket {
    bucket_start: string;
    total_time_seconds: number;
    total_sessions: number;
    average_completion_percentage: number | null;
    /** A day of a week or a month that the streak counted as rest. Months and years have none. */
    is_rest_day: boolean;
}

export interface DashboardData {
    period: {
        type: DashboardPeriod;
        anchor_date: string;
        start_date: string | null;
        end_date: string;
    };
    summary: {
        total_time_seconds: number;
        total_sessions: number;
        average_completion_percentage: number | null;
        average_session_time_seconds: number | null;
    };
    trend: TrendBucket[];
}

/** `today` is today without work: it is still open, so it is not rest or missed. */
export type CalendarState = 'work' | 'rest' | 'missed' | 'neutral' | 'today';

export interface CalendarDay {
    date: string;
    state: CalendarState;
    /** The sessions of that local day, and the time worked in them. */
    total_sessions: number;
    total_time_seconds: number;
}

export interface StreakData {
    current_streak: number;
    /** The days with work, ever. */
    total_worked_days: number;
    rest_days_remaining_this_week: number;
    calendar: {
        month: string;
        days: CalendarDay[];
    };
}
