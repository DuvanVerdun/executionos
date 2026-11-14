import { describe, expect, it } from 'vitest';
import type { LiveSession } from '../types/rooms';
import { ringFill, workedSeconds } from './live-session';

const SESSION: LiveSession = { mission: null, target_time_seconds: 3600, actual_time_seconds: 1200 };

describe('the time worked of a live session', () => {
    it('goes on counting from the answer while the session is running', () => {
        expect(workedSeconds(SESSION, 'working', 30)).toBe(1230);
    });

    it('stays where the pause left it while the session is paused', () => {
        expect(workedSeconds(SESSION, 'paused', 30)).toBe(1200);
    });
});

describe('the ring of a live session', () => {
    it('fills the teal part up to the target, with no white yet', () => {
        expect(ringFill(900, 3600)).toEqual({ filled: 25, over: 0 });
    });

    it('is full and starts to turn white once the target is passed', () => {
        expect(ringFill(5400, 3600)).toEqual({ filled: 100, over: 50 });
    });

    it('does not go further than a full white ring', () => {
        expect(ringFill(20000, 3600)).toEqual({ filled: 100, over: 100 });
    });

    it('stays empty when there is no target to measure against', () => {
        expect(ringFill(100, 0)).toEqual({ filled: 0, over: 0 });
    });
});
