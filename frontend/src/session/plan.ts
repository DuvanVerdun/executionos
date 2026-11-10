import { t } from '../i18n/i18n';
import { parseHHMMToSeconds } from '../lib/durations';
import { navigateTo } from '../shared/navigation';
import { updateActiveSession } from './state';
import { startTimer } from './timer';

/** The first problem found in a mission card, and the field it belongs to. */
export interface MissionValidationError {
    field: 'mission' | 'targetTime';
    message: string;
}

/** Return a mission or duration validation error, or an empty string. */
function validatePlan(mission: string, targetTime: string): string {
    if (!mission.trim()) return t('mission.required');
    if (mission.length > 50) return t('mission.tooLong');
    if (!targetTime || !/^\d{2}:\d{2}$/.test(targetTime)) {
        return t('mission.timeFormat');
    }
    const [hours = 0, minutes = 0] = targetTime.split(':').map(Number);
    if (minutes > 59) return t('mission.minutesRange');
    if (hours === 0 && minutes === 0) return t('mission.timeZero');
    return '';
}

/** Validate a mission card's fields. Return the first error, or null when they are valid. */
export function validateMissionFields(mission: string, targetTime: string): MissionValidationError | null {
    const message = validatePlan(mission, targetTime);
    if (!message) return null;
    const isMissionError = !mission.trim() || mission.length > 50;
    return { field: isMissionError ? 'mission' : 'targetTime', message };
}

/** Start a timestamp-based work session from a valid plan. */
export function startWork(mission: string, targetTime: string): void {
    updateActiveSession({
        currentMission: mission,
        targetTimeSeconds: parseHHMMToSeconds(targetTime),
        startTimestamp: new Date().toISOString()
    });
    navigateTo('focus', 'plan');
    startTimer();
}
