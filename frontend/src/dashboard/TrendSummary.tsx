import { useT } from '../i18n/i18n';
import { formatMonthAndYear, formatShortDate, parseLocalDate } from '../lib/dates';
import { formatDurationHoursMinutes } from '../lib/durations';
import type { DashboardMetric, DashboardPeriod, TrendBucket } from '../types/dashboard';

interface TrendSummaryProps {
    bucket: TrendBucket;
    period: DashboardPeriod;
    metric: DashboardMetric;
}

/** Draw what the summary card of a chart point says: its date, and what the selected metric holds there. */
export function TrendSummary({ bucket, period, metric }: TrendSummaryProps) {
    const t = useT();
    const date = parseLocalDate(bucket.bucket_start);
    const sessions = bucket.total_sessions === 1 ? t('streak.sessionsOne') : t('streak.sessionsOther', { count: bucket.total_sessions });
    const focused = t('session.focused', { time: formatDurationHoursMinutes(bucket.total_time_seconds) });
    let detail: string;
    if (bucket.is_rest_day) {
        detail = t('landing.tip.rest');
    } else if (metric === 'time') {
        detail = bucket.total_sessions > 0 ? `${sessions} · ${focused}` : focused;
    } else if (metric === 'completion') {
        detail = t('dashboard.completionSummary', { percent: Math.round(bucket.average_completion_percentage ?? 0) });
    } else {
        detail = bucket.total_sessions > 0 ? sessions : t('streak.noSessions');
    }
    return (
        <>
            <p>{period === 'week' || period === 'month' ? formatShortDate(date) : formatMonthAndYear(date)}</p>
            <p className="streak-day-summary-detail">{detail}</p>
        </>
    );
}
