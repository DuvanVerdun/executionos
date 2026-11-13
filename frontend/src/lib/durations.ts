import { t } from '../i18n/i18n';

/** Convert an HH:MM duration to seconds. */
export function parseHHMMToSeconds(timeString: string): number {
    const [hours, minutes] = timeString.split(':');
    return parseInt(hours ?? '') * 3600 + parseInt(minutes ?? '') * 60;
}

/** Format elapsed seconds for the timer display. */
export function formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours >= 1) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    if (minutes >= 1) return `${minutes}:${String(seconds).padStart(2, '0')}`;
    return String(seconds);
}

/** Format a duration using hours and whole minutes. */
export function formatDurationHoursMinutes(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours >= 1) return `${hours}h ${minutes}${t('common.minutesShort')}`;
    return `${minutes}${t('common.minutesShort')}`;
}

/** Format a duration with unit labels and sub-minute seconds. */
export function formatDurationHoursMinutesSeconds(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    if (hours >= 1) {
        if (seconds >= 1) return `${hours}h ${minutes}${t('common.minutesShort')} ${seconds}s`;
        return `${hours}h ${minutes}${t('common.minutesShort')}`;
    }
    if (minutes >= 1) {
        if (seconds >= 1) return `${minutes}${t('common.minutesShort')} ${seconds}s`;
        return `${minutes}${t('common.minutesShort')}`;
    }
    return `${seconds} ${t('common.secondsLong')}`;
}

/** Format an average session time. Averages under a minute show seconds. */
export function formatAverageSessionTime(totalSeconds: number | null): string {
    if (totalSeconds === null) return '0m';
    if (totalSeconds < 60) return `${totalSeconds}s`;
    return formatDurationHoursMinutes(totalSeconds);
}

/** Format seconds as a HH:MM input value, rounded up to the next whole minute. */
export function formatSecondsAsHHMM(totalSeconds: number): string {
    const totalMinutes = Math.min(Math.ceil(totalSeconds / 60), 99 * 60 + 59);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Format seconds as m:ss for a countdown. */
export function formatCountdown(totalSeconds: number): string {
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}
