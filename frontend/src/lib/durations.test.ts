import { describe, expect, it } from 'vitest';
import { setLanguage } from '../i18n/i18n';
import {
    formatAverageSessionTime,
    formatCountdown,
    formatDuration,
    formatDurationHoursMinutes,
    formatDurationHoursMinutesSeconds,
    formatSecondsAsHHMM,
    parseHHMMToSeconds
} from './durations';

describe('parseHHMMToSeconds', () => {
    it.each([
        ['00:25', 1500],
        ['01:30', 5400],
        ['00:00', 0],
        ['99:59', 359940]
    ])('turns %s into %i seconds', (text, seconds) => {
        expect(parseHHMMToSeconds(text)).toBe(seconds);
    });
});

describe('formatDuration (the timer display)', () => {
    it.each([
        [0, '0'],
        [5, '5'],
        [60, '1:00'],
        [65, '1:05'],
        [3600, '1:00:00'],
        [3725, '1:02:05']
    ])('shows %i seconds as %s', (seconds, text) => {
        expect(formatDuration(seconds)).toBe(text);
    });
});

describe('formatDurationHoursMinutes', () => {
    it.each([
        [0, '0m'],
        [59, '0m'],
        [1500, '25m'],
        [3600, '1h 0m'],
        [5400, '1h 30m']
    ])('shows %i seconds as %s', (seconds, text) => {
        expect(formatDurationHoursMinutes(seconds)).toBe(text);
    });
});

describe('formatDurationHoursMinutesSeconds', () => {
    it.each([
        [0, '0 sec'],
        [5, '5 sec'],
        [60, '1m'],
        [65, '1m 5s'],
        [3660, '1h 1m'],
        [3725, '1h 2m 5s']
    ])('shows %i seconds as %s', (seconds, text) => {
        expect(formatDurationHoursMinutesSeconds(seconds)).toBe(text);
    });
});

describe('formatAverageSessionTime', () => {
    it('shows 0m when there is no average', () => {
        expect(formatAverageSessionTime(null)).toBe('0m');
    });

    it('shows seconds under a minute', () => {
        expect(formatAverageSessionTime(45)).toBe('45s');
    });

    it('shows hours and minutes from a minute up', () => {
        expect(formatAverageSessionTime(90)).toBe('1m');
    });
});

describe('formatSecondsAsHHMM', () => {
    it.each([
        [0, '00:00'],
        [60, '00:01'],
        [61, '00:02'],
        [3600, '01:00'],
        [5460, '01:31']
    ])('rounds %i seconds up to %s', (seconds, text) => {
        expect(formatSecondsAsHHMM(seconds)).toBe(text);
    });

    it('stops at 99:59', () => {
        expect(formatSecondsAsHHMM(10_000_000)).toBe('99:59');
    });
});

describe('formatCountdown', () => {
    it.each([
        [0, '0:00'],
        [5, '0:05'],
        [65, '1:05'],
        [300, '5:00']
    ])('shows %i seconds as %s', (seconds, text) => {
        expect(formatCountdown(seconds)).toBe(text);
    });
});

describe('the units in Spanish', () => {
    it('write minutes as min and seconds as seg', () => {
        setLanguage('es');
        expect(formatDurationHoursMinutes(5400)).toBe('1h 30min');
        expect(formatDurationHoursMinutes(600)).toBe('10min');
        expect(formatDurationHoursMinutesSeconds(11)).toBe('11 seg');
        expect(formatDurationHoursMinutesSeconds(6540)).toBe('1h 49min');
    });
});
