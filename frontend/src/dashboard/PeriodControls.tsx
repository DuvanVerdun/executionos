import { useRef, useState } from 'react';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useT, type TranslationKey } from '../i18n/i18n';
import { formatLocalDate, formatMonthName, formatPeriodDate, parseLocalDate } from '../lib/dates';
import { useStore } from '../lib/store';
import type { DashboardPeriod } from '../types/dashboard';
import { changeDashboardPeriod, dashboardStore, moveDashboardPeriod, type PeriodRange } from './dashboard';

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
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const isAllTime = period === 'all_time';
    const today = formatLocalDate(new Date());

    useDocumentEvent('click', /** Close the period menu when a click occurs outside it. */ (event) => {
        if (event.target instanceof Node && filterRef.current?.contains(event.target)) return;
        setIsMenuOpen(false);
    }, isMenuOpen);

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

            <div ref={filterRef} className="dashboard-period-filter">
                <button
                    type="button"
                    className="dashboard-period-filter-btn"
                    aria-label={t('dashboard.choosePeriod')}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    onClick={() => { setIsMenuOpen(!isMenuOpen); }}
                >
                    <span className="material-symbols-outlined" aria-hidden="true">filter_list</span>
                </button>
                {isMenuOpen && (
                    <div className="dashboard-period-menu" role="menu" aria-label={t('dashboard.choosePeriod')}>
                        {PERIODS.map(/** Draw the button of one period. The selected one is checked. */ (option) => (
                            <button
                                key={option.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={option.value === period}
                                data-dashboard-period={option.value}
                                onClick={() => { setIsMenuOpen(false); void changeDashboardPeriod(option.value); }}
                            >
                                {t(option.label)}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
