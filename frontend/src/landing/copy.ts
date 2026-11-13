import { t } from '../i18n/i18n';
import { formatMonthName } from '../lib/dates';
import { getDaysLeftInMonth } from './demo';

/** Say how many days are left in the month of today, like "18 days left in November.". */
export function describeDaysLeft(today: Date): string {
    const daysLeft = getDaysLeftInMonth(today);
    const month = formatMonthName(today);
    if (daysLeft === 0) return t('landing.daysLeft.last', { month });
    if (daysLeft === 1) return t('landing.daysLeft.one', { month });
    return t('landing.daysLeft.many', { count: daysLeft, month });
}

/** Say that the days left in the month are circles that can still be filled. */
export function describeDaysAsCircles(today: Date): string {
    const daysLeft = getDaysLeftInMonth(today);
    if (daysLeft === 0) return t('landing.clock.lineLast');
    if (daysLeft === 1) return t('landing.clock.lineOne');
    return t('landing.clock.lineMany', { count: daysLeft });
}
