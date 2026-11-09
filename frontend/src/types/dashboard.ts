export type DashboardPeriod = 'week' | 'month' | 'year' | 'all_time';

export type DashboardMetric = 'time' | 'sessions' | 'completion';

export interface TrendBucket {
    bucket_start: string;
    total_time_seconds: number;
    total_sessions: number;
    average_completion_percentage: number | null;
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

export type CalendarState = 'work' | 'rest' | 'missed' | 'neutral';

export interface CalendarDay {
    date: string;
    state: CalendarState;
}

export interface StreakData {
    current_streak: number;
    rest_days_remaining_this_week: number;
    calendar: {
        month: string;
        days: CalendarDay[];
    };
}
