import { useT } from '../i18n/i18n';
import { addDays, formatShortMonthName, parseLocalDate } from '../lib/dates';
import { formatDurationHoursMinutes, formatAverageSessionTime } from '../lib/durations';
import type { CalendarState } from '../types/dashboard';
import type { ProfileData as ProfileDataFields } from '../types/social';
import { LockIcon } from './icons';

/** The first column of a month label that starts a new month, with its name. */
interface MonthLabel {
    column: number;
    name: string;
}

/** Return the label of each month that begins in a column of the heatmap. A column is a week, and counts for the month of its Monday. */
function monthLabels(startDate: string, columns: number): MonthLabel[] {
    const start = parseLocalDate(startDate);
    const labels: MonthLabel[] = [];
    let previousMonth = -1;
    for (let column = 0; column < columns; column += 1) {
        const monday = addDays(start, column * 7);
        if (monday.getMonth() === previousMonth) continue;
        previousMonth = monday.getMonth();
        labels.push({ column, name: formatShortMonthName(monday) });
    }
    return labels;
}

/** Return the class of one day of the heatmap. Missed days and days that are not in the streak look like days without work. */
function dayClass(state: CalendarState): string {
    return state === 'work' || state === 'rest' || state === 'today' ? `heatmap-day heatmap-day-${state}` : 'heatmap-day';
}

/** Draw the streak of the user and their best one. */
function StreakHero({ streak }: { streak: ProfileDataFields['streak'] }) {
    const t = useT();
    return (
        <section className="profile-streak">
            <div className="profile-streak-current">
                <p className="profile-streak-number">
                    <span className={streak.current === 0 ? 'profile-streak-flame is-off' : 'profile-streak-flame'} aria-hidden="true">🔥</span>
                    {streak.current}
                </p>
                <p className="profile-streak-label">{streak.current === 1 ? t('profile.streakOne') : t('profile.streakOther')}</p>
            </div>
            <div className="profile-streak-best">
                <p className="profile-streak-best-value">{streak.best}</p>
                <p className="profile-streak-best-label">{t('profile.bestStreak')}</p>
            </div>
        </section>
    );
}

/** Draw the days of the last six months, one circle for each, a column for each week. */
function Heatmap({ heatmap }: { heatmap: ProfileDataFields['heatmap'] }) {
    const t = useT();
    const columns = heatmap.states.length / 7;
    return (
        <section className="profile-heatmap">
            <div className="profile-heatmap-margin">
                <h2 className="profile-section-title">{t('profile.heatmapTitle')}</h2>
            </div>
            <div className="profile-heatmap-body" role="img" aria-label={t('profile.heatmapLabel')}>
                <div className="profile-heatmap-months" aria-hidden="true">
                    {monthLabels(heatmap.start_date, columns).map(/** Draw the name of one month above its first column. */ (label) => (
                        <span key={label.column} style={{ gridColumn: label.column + 1 }}>{label.name}</span>
                    ))}
                </div>
                <div className="profile-heatmap-days" aria-hidden="true">
                    {heatmap.states.map(/** Draw one day. */ (state, index) => <span key={index} className={dayClass(state)}></span>)}
                </div>
            </div>
            <div className="profile-heatmap-margin">
                <div className="profile-heatmap-legend">
                    <span><i className="heatmap-marker heatmap-day-work"></i>{t('streak.legendWork')}</span>
                    <span><i className="heatmap-marker heatmap-day-rest"></i>{t('streak.legendRest')}</span>
                    <span><i className="heatmap-marker heatmap-day-today"></i>{t('streak.legendToday')}</span>
                </div>
            </div>
        </section>
    );
}

/** Draw the four numbers of the last 30 days. */
function StatCards({ stats }: { stats: ProfileDataFields['stats'] }) {
    const t = useT();
    const cards = [
        { value: formatDurationHoursMinutes(stats.total_time_seconds), label: t('review.focused') },
        { value: String(stats.total_sessions), label: t('review.sessions') },
        { value: String(stats.days_worked), label: t('dashboard.daysWorked') },
        { value: stats.average_session_time_seconds === null ? '—' : formatAverageSessionTime(stats.average_session_time_seconds), label: t('review.averageSessionTime') }
    ];
    return (
        <section className="profile-stats">
            <h2 className="profile-section-title">{t('profile.statsTitle')}</h2>
            <div className="dashboard-summary-grid">
                {cards.map(/** Draw one number. */ (card) => (
                    <div key={card.label} className="dashboard-summary-card">
                        <p className="dashboard-summary-value">{card.value}</p>
                        <p className="dashboard-summary-label">{card.label}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}

/** Draw what a user may see of a profile: the streak, the heatmap and the stats. */
export function ProfileData({ data }: { data: ProfileDataFields }) {
    return (
        <div className="profile-data">
            <StreakHero streak={data.streak} />
            <Heatmap heatmap={data.heatmap} />
            <StatCards stats={data.stats} />
        </div>
    );
}

/** Draw what a user who may not see a profile gets in place of its data. */
export function LockedProfile({ username, isPrivate, isRequested }: { username: string; isPrivate: boolean; isRequested: boolean }) {
    const t = useT();
    const title = isPrivate ? t('profile.privateTitle') : t('profile.followToSee', { username });
    const text = !isPrivate ? t('profile.followToSeeText') : isRequested ? t('profile.privateRequested') : t('profile.privateText');
    return (
        <div className="profile-locked">
            <span className="profile-locked-icon"><LockIcon /></span>
            <h2 className="profile-locked-title">{title}</h2>
            <p className="profile-locked-text">{text}</p>
        </div>
    );
}
