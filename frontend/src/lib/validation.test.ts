import { describe, expect, it } from 'vitest';
import { getPasswordError } from './validation';

describe('getPasswordError', () => {
    it('asks for at least 12 characters first', () => {
        expect(getPasswordError('Ab1!')).toBe('At least 12 characters.');
    });

    it.each([
        ['no uppercase', 'abcdefghij1!'],
        ['no lowercase', 'ABCDEFGHIJ1!'],
        ['no number', 'Abcdefghijk!'],
        ['no symbol', 'Abcdefghijk1']
    ])('rejects a long password with %s', (_reason, password) => {
        expect(getPasswordError(password)).toBe('Add uppercase, lowercase, a number and a symbol.');
    });

    it.each(['Abcdefghij1!', 'Correct-Horse-9', 'xxxxxxxxxxY1/'])('accepts %s', (password) => {
        expect(getPasswordError(password)).toBe('');
    });
});
