import { getMonthDays } from './demo';

interface MonthStripProps {
    today: Date;
    /** `idle` leaves the days ahead empty. `filled` shows them filled with work. */
    mode: 'idle' | 'filled';
}

/** Draw every day of the month in a row: the days behind, today, and the days ahead. */
export function MonthStrip({ today, mode }: MonthStripProps) {
    return (
        <div className="landing-strip" aria-hidden="true">
            {getMonthDays(today).map(/** Draw one day of the month. */ ({ day, kind }) => (
                <span key={day} className={`landing-strip-day landing-strip-day-${kind === 'future' ? mode : kind}`}>{day}</span>
            ))}
        </div>
    );
}
