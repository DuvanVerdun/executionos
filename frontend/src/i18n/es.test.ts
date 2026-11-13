import { describe, expect, it } from 'vitest';
import { en } from './en';
import { es } from './es';

/** Return the names of the {slots} of a text, in order. */
function slotsOf(text: string): string[] {
    return Array.from(text.matchAll(/\{(\w+)\}/g), /** Read the name of a slot. */ (match) => match[1] ?? '').sort();
}

describe('the Spanish texts', () => {
    it('have a text for every English key, and no key that English does not have', () => {
        expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
    });

    it('are not empty', () => {
        for (const text of Object.values(es)) expect(text.trim()).not.toBe('');
    });

    it('have the same slots as the English text', () => {
        for (const key of Object.keys(en) as (keyof typeof en)[]) {
            expect(slotsOf(es[key] ?? ''), key).toEqual(slotsOf(en[key]));
        }
    });
});
