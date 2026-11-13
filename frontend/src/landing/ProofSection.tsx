import { TrendChart } from '../dashboard/TrendChart';
import { useT, type TranslationKey } from '../i18n/i18n';
import { formatDurationHoursMinutes } from '../lib/durations';
import { demoStats, demoTrend } from './demo';

const METRICS = [
    { value: 'time', label: 'dashboard.metricTime' },
    { value: 'completion', label: 'dashboard.metricCompletion' },
    { value: 'sessions', label: 'dashboard.metricSessions' }
] as const satisfies readonly { value: string; label: TranslationKey }[];

/** Draw the section that shows the stats and the chart of the dashboard, filled with a month of work. Nothing in it can be used. */
export function ProofSection({ today }: { today: Date }) {
    const t = useT();
    const stats = demoStats();
    return (
        <section className="landing-section landing-proof" aria-labelledby="landing-proof-title">
            <p className="landing-kicker landing-kicker-pain">{t('landing.proof.kicker')}</p>
            <h2 id="landing-proof-title" className="landing-title">{t('landing.proof.title')}</h2>
            <div className="landing-demo landing-proof-demo" inert>
                <div className="dashboard-summary-grid">
                    <div className="dashboard-summary-card">
                        <p className="dashboard-summary-value">{formatDurationHoursMinutes(stats.totalTimeSeconds)}</p>
                        <p className="dashboard-summary-label">{t('review.focused')}</p>
                    </div>
                    <div className="dashboard-summary-card">
                        <p className="dashboard-summary-value">{String(stats.totalSessions)}</p>
                        <p className="dashboard-summary-label">{t('review.sessions')}</p>
                    </div>
                    <div className="dashboard-summary-card">
                        <p className="dashboard-summary-value">{`${stats.averageCompletionPercentage}%`}</p>
                        <p className="dashboard-summary-label">{t('dashboard.averageCompletion')}</p>
                    </div>
                    <div className="dashboard-summary-card">
                        <p className="dashboard-summary-value">{formatDurationHoursMinutes(stats.averageSessionSeconds)}</p>
                        <p className="dashboard-summary-label">{t('review.averageSessionTime')}</p>
                    </div>
                </div>
                <div className="dashboard-trend-section">
                    <div className="dashboard-metric-toggle">
                        {METRICS.map(/** Draw a metric button. The first one is selected. */ ({ value, label }) => (
                            <button key={value} type="button" className={value === 'time' ? 'active' : undefined}>{t(label)}</button>
                        ))}
                    </div>
                    <TrendChart buckets={demoTrend(today)} period="month" metric="time" />
                </div>
            </div>
        </section>
    );
}
