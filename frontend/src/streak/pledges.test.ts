import { describe, expect, it } from 'vitest';
import { pickPledge } from './pledges';

/** Return every text a streak can get, by trying a random number from each part of 0 up to 1. */
function textsFor(streak: number): Set<string> {
    return new Set(Array.from({ length: 100 }, /** Pick with the given random number. */ (_, index) => pickPledge(streak, () => index / 100).say(streak + 1)));
}

describe('the pledges of the streak screen', () => {
    it('are picked at random: another random number can give another pledge', () => {
        expect(pickPledge(10, () => 0).say(11)).not.toBe(pickPledge(10, () => 0.99).say(11));
    });

    it('fill in the day the user gives their word for', () => {
        expect(pickPledge(3, () => 0).say(4)).toBe('Day 4 is mine!');
    });

    it('never pick past the last pledge that fits, even with the largest random number', () => {
        expect(() => pickPledge(1, () => 0.999999).say(2)).not.toThrow();
    });

    it('leave out what talks about keeping a streak going when the streak just began', () => {
        const day1 = textsFor(1);
        for (const text of ["I won't break it!", 'The flame stays lit', "Nothing stops day 2", "I'll keep it burning"]) {
            expect(day1).not.toContain(text);
        }
        expect(day1.size).toBe(12);
    });

    it('add "I won\'t break it!" and "The flame stays lit" from day 3', () => {
        expect(textsFor(2)).not.toContain("I won't break it!");
        expect(textsFor(3)).toContain("I won't break it!");
        expect(textsFor(3)).toContain('The flame stays lit');
        expect(textsFor(3).size).toBe(14);
    });

    it('add "Nothing stops" from day 5, and "I\'ll keep it burning" from day 7', () => {
        expect(textsFor(4)).not.toContain('Nothing stops day 5');
        expect(textsFor(5)).toContain('Nothing stops day 6');
        expect(textsFor(6)).not.toContain("I'll keep it burning");
        expect(textsFor(7)).toContain("I'll keep it burning");
        expect(textsFor(7).size).toBe(16);
    });
});
