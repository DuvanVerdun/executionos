import { describe, expect, it } from 'vitest';
import { at } from './arrays';
import { errorStatus, StatusError } from './errors';

describe('errorStatus', () => {
    it('reads the status of a StatusError', () => {
        expect(errorStatus(new StatusError('nope', 404))).toBe(404);
    });

    it.each([new Error('plain'), 'text', null, undefined, { status: 500 }])('has no status for %j', (value) => {
        expect(errorStatus(value)).toBeUndefined();
    });

    it('keeps the message', () => {
        expect(new StatusError('Unauthorized', 401).message).toBe('Unauthorized');
    });
});

describe('at', () => {
    it('returns the item at an index', () => {
        expect(at(['a', 'b'], 1)).toBe('b');
    });

    it('throws when there is no item, instead of returning undefined', () => {
        expect(() => at(['a'], 3)).toThrow(RangeError);
    });
});
