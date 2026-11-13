import { describe, expect, it } from 'vitest';
import { millisecondsUntilNextSecond } from './timing';

describe('millisecondsUntilNextSecond', () => {
    it.each([
        [10, 1005],
        [10.25, 755],
        [10.5, 505],
        [10.999, 6],
        [0, 1005]
    ])('waits for the next whole second from %s seconds', (exactSeconds, expected) => {
        expect(millisecondsUntilNextSecond(exactSeconds)).toBeCloseTo(expected, 5);
    });

    it('always waits a little more than the time left, so the timer never wakes up early', () => {
        for (let exactSeconds = 0; exactSeconds < 5; exactSeconds += 0.0137) {
            const timeLeftMs = (Math.floor(exactSeconds) + 1 - exactSeconds) * 1000;
            expect(millisecondsUntilNextSecond(exactSeconds)).toBeGreaterThan(timeLeftMs);
        }
    });

    it('never waits more than a second and a margin', () => {
        expect(millisecondsUntilNextSecond(42)).toBeLessThanOrEqual(1010);
    });

    it('also works for a negative time, for example after the clock moved back', () => {
        expect(millisecondsUntilNextSecond(-0.3)).toBeCloseTo(305, 5);
    });
});
