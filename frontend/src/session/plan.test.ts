import { describe, expect, it } from 'vitest';
import { screenStore } from '../shared/navigation';
import { startWork, validateMissionFields } from './plan';
import { sessionStore } from './state';
import { pauseSession } from './timer';

describe('validateMissionFields', () => {
    it('accepts a mission and a focus time', () => {
        expect(validateMissionFields('Write tests', '00:25')).toBeNull();
    });

    it.each([
        ['', '00:25', 'mission', 'Enter your mission.'],
        ['   ', '00:25', 'mission', 'Enter your mission.'],
        ['x'.repeat(51), '00:25', 'mission', 'Keep your mission to 50 characters or fewer.'],
        ['Write', '', 'targetTime', 'Enter a focus time as HH:MM, for example 00:25.'],
        ['Write', '0:25', 'targetTime', 'Enter a focus time as HH:MM, for example 00:25.'],
        ['Write', 'ab:cd', 'targetTime', 'Enter a focus time as HH:MM, for example 00:25.'],
        ['Write', '00:75', 'targetTime', 'Enter minutes between 00 and 59.'],
        ['Write', '00:00', 'targetTime', 'Choose a focus time greater than zero.']
    ])('rejects mission %j with time %j', (mission, time, field, message) => {
        expect(validateMissionFields(mission, time)).toEqual({ field, message });
    });

    it('accepts a mission of exactly 50 characters', () => {
        expect(validateMissionFields('x'.repeat(50), '00:01')).toBeNull();
    });

    it('reports the mission problem before the time problem', () => {
        expect(validateMissionFields('', '00:00')?.field).toBe('mission');
    });
});

describe('startWork', () => {
    it('starts the timer with the mission and the target, and shows Focus', () => {
        screenStore.set({ screen: 'plan' });
        startWork('Write tests', '00:25');
        const { active } = sessionStore.get();
        expect(active.currentMission).toBe('Write tests');
        expect(active.targetTimeSeconds).toBe(1500);
        expect(active.isTimerRunning).toBe(true);
        expect(Number.isNaN(Date.parse(active.startTimestamp))).toBe(false);
        expect(screenStore.get().screen).toBe('focus');
        pauseSession();
    });
});
