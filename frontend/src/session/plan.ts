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
    if (!mission.trim()) return 'Enter your mission.';
    if (mission.length > 50) return 'Keep your mission to 50 characters or fewer.';
    if (!targetTime || !/^\d{2}:\d{2}$/.test(targetTime)) {
        return 'Enter a focus time as HH:MM, for example 00:25.';
    }
    const [hours = 0, minutes = 0] = targetTime.split(':').map(Number);
    if (minutes > 59) return 'Enter minutes between 00 and 59.';
    if (hours === 0 && minutes === 0) return 'Choose a focus time greater than zero.';
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
