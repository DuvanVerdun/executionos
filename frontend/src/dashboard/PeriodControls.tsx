import { useT, type TranslationKey } from '../i18n/i18n';
import { formatLocalDate, formatMonthName, formatPeriodDate, parseLocalDate } from '../lib/dates';
import { useStore } from '../lib/store';
import type { DashboardPeriod } from '../types/dashboard';
import { changeDashboardPeriod, dashboardStore, moveDashboardPeriod, type PeriodRange } from './dashboard';
import { FilterMenu } from './FilterMenu';

const PERIODS = [
    { value: 'week', label: 'dashboard.week' },
    { value: 'month', label: 'dashboard.month' },
    { value: 'year', label: 'dashboard.year' },
    { value: 'all_time', label: 'dashboard.allTime' }
] as const satisfies readonly { value: DashboardPeriod; label: TranslationKey }[];

/** Return the text of the period label: a month, a year, a range of days, or nothing for all time. */
function getPeriodLabel(period: DashboardPeriod, range: PeriodRange): string {
    if (period === 'all_time' || range.start_date === null) return '';
    if (period === 'month') {
        return formatMonthName(parseLocalDate(range.start_date));
    }
    if (period === 'year') return String(parseLocalDate(range.start_date).getFullYear());
    return `${formatPeriodDate(range.start_date)} – ${formatPeriodDate(range.end_date)}`;
}

/** Draw the buttons that move to the previous or next period, and the filter button with the menu of periods. */
export function PeriodControls() {
    const t = useT();
    const { period, periodRange } = useStore(dashboardStore);
    const isAllTime = period === 'all_time';
    const today = formatLocalDate(new Date());

    return (
        <div className="dashboard-period-controls">
            <div className="dashboard-period-navigation" hidden={isAllTime}>
                <button
                    type="button"
                    id="dashboard-previous-period-btn"
                    aria-label={t('dashboard.previousPeriod')}
                    disabled={isAllTime}
                    onClick={() => { void moveDashboardPeriod(-1); }}
                >
                    <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
                </button>

                <p id="dashboard-period-label">{getPeriodLabel(period, periodRange)}</p>

                <button
                    type="button"
                    id="dashboard-next-period-btn"
                    aria-label={t('dashboard.nextPeriod')}
                    disabled={isAllTime || periodRange.end_date >= today}
                    onClick={() => { void moveDashboardPeriod(1); }}
                >
                    <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
                </button>
            </div>

            <FilterMenu
                label="dashboard.choosePeriod"
                options={PERIODS}
                selected={period}
                onSelect={(value) => { void changeDashboardPeriod(value); }}
            />
        </div>
    );
}
