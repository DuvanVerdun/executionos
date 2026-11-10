import { createStore, useStoreSelector } from '../lib/store';
import { en } from './en';
import { es } from './es';

/** The languages the app can show. */
export type Language = 'en' | 'es';

/** Every text in the app has a key. The English dictionary decides which keys exist. */
export type TranslationKey = keyof typeof en;

/** The names of the `{slots}` inside a text. */
type Slots<Text extends string> = Text extends `${string}{${infer Name}}${infer Rest}` ? Name | Slots<Rest> : never;

/** What a key needs besides itself: nothing, or the values for its slots. */
type TranslationArguments<Key extends TranslationKey> = [Slots<(typeof en)[Key]>] extends [never]
    ? []
    : [values: Record<Slots<(typeof en)[Key]>, string | number>];

/** The language the app shows now. */
export const languageStore = createStore<{ language: Language }>({ language: 'en' });

const dictionaries: Record<Language, Partial<Record<TranslationKey, string>>> = { en, es };

/** Put the values into the `{slots}` of a text. */
function fillSlots(text: string, values: Record<string, string | number> | undefined): string {
    if (values === undefined) return text;
    return text.replace(/\{(\w+)\}/g, /** Replace one slot with its value. */ (slot: string, name: string) => String(values[name] ?? slot));
}

/** Return the text of a key in a language. A text missing in that language falls back to English. */
export function translate<Key extends TranslationKey>(language: Language, key: Key, ...values: TranslationArguments<Key>): string {
    const text = dictionaries[language][key] ?? en[key];
    return fillSlots(text, values[0]);
}

/** Return the text of a key in the language the app shows now. Use it in code that is not a component. */
export function t<Key extends TranslationKey>(key: Key, ...values: TranslationArguments<Key>): string {
    return translate(languageStore.get().language, key, ...values);
}

/** Return `t` in a component. The component renders again when the language changes. */
export function useT(): typeof t {
    useStoreSelector(languageStore, /** Read the language. */ (state) => state.language);
    return t;
}

/** Change the language the app shows. */
export function setLanguage(language: Language): void {
    languageStore.set({ language });
}
