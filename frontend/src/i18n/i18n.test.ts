import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { en } from './en';
import { es } from './es';
import { languageStore, setLanguage, t, translate, useT, type TranslationKey } from './i18n';

afterEach(() => {
    delete es['common.retry'];
    delete es['review.target'];
});

describe('t', () => {
    it('returns the English text of a key', () => {
        expect(t('common.retry')).toBe('Retry');
    });

    it('fills the slots of a text', () => {
        expect(t('review.target', { time: '25m' })).toBe('Target: 25m');
    });

    it('accepts a number for a slot', () => {
        expect(t('dashboard.dailySessions', { count: 3 })).toBe('3 sessions');
    });

    it('fills every slot of a text that has more than one', () => {
        expect(t('rooms.endMissedSaved', { time: '40m' })).toBe("You didn't check in. Session saved up to 40m.");
    });
});

describe('the language', () => {
    it('starts in English', () => {
        expect(languageStore.get().language).toBe('en');
    });

    it('falls back to English for a text that Spanish does not have yet', () => {
        setLanguage('es');
        expect(t('common.retry')).toBe('Retry');
    });

    it('uses the Spanish text when there is one', () => {
        es['common.retry'] = 'Reintentar';
        setLanguage('es');
        expect(t('common.retry')).toBe('Reintentar');
        expect(translate('en', 'common.retry')).toBe('Retry');
    });

    it('fills slots in a Spanish text', () => {
        es['review.target'] = 'Meta: {time}';
        setLanguage('es');
        expect(t('review.target', { time: '25m' })).toBe('Meta: 25m');
    });
});

describe('useT', () => {
    it('makes a component render again when the language changes', () => {
        es['common.retry'] = 'Reintentar';
        const { result } = renderHook(() => {
            const text = useT();
            return text('common.retry');
        });
        expect(result.current).toBe('Retry');
        act(() => { setLanguage('es'); });
        expect(result.current).toBe('Reintentar');
    });
});

describe('the keys', () => {
    it('are typed: only existing keys are accepted, and slots must be filled', () => {
        expectTypeOf<Parameters<typeof t>[0]>().toEqualTypeOf<TranslationKey>();
        expectTypeOf<Parameters<typeof t<'common.retry'>>>().toEqualTypeOf<[key: 'common.retry']>();
        expectTypeOf<Parameters<typeof t<'review.target'>>>().toEqualTypeOf<
            [key: 'review.target', values: Record<'time', string | number>]
        >();
    });

    it('are named feature.name', () => {
        for (const key of Object.keys(en)) expect(key).toMatch(/^[a-z]+(\.[a-zA-Z]+)+$/);
    });

    it('all have a text', () => {
        for (const text of Object.values(en)) expect(text.trim()).not.toBe('');
    });
});
