import { useState } from 'react';
import { formatLocalDate } from '../lib/dates';
import { useDocumentEvent } from './useDocumentEvent';

/** Return today's date. When the tab comes back to the screen on a later day, the date is today's again. */
export function useToday(): Date {
    const [today, setToday] = useState(() => new Date());

    useDocumentEvent('visibilitychange', /** Take the new date when the day changed while the tab was away. */ () => {
        if (document.hidden) return;
        const now = new Date();
        setToday(/** Keep the same date object while the day is the same, so nothing draws again. */ (current) =>
            formatLocalDate(current) === formatLocalDate(now) ? current : now
        );
    });

    return today;
}
