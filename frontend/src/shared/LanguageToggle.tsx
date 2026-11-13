import { languageStore, setLanguage, useT, type Language } from '../i18n/i18n';
import { useStoreSelector } from '../lib/store';

/** The languages of the toggle, each written as its short code. */
const TOGGLE_OPTIONS = [
    { language: 'es', code: 'ES' },
    { language: 'en', code: 'EN' }
] as const satisfies readonly { language: Language; code: string }[];

/** Draw the two-language toggle of the Landing and the auth screens. The chosen language sits on a white circle that slides to the other one. */
export function LanguageToggle() {
    const t = useT();
    const current = useStoreSelector(languageStore, /** Read the language. */ (state) => state.language);
    const selectedIndex = TOGGLE_OPTIONS.findIndex(/** Find the chosen language. */ (option) => option.language === current);

    return (
        <div className="language-toggle" role="group" aria-label={t('header.chooseLanguage')} data-selected={selectedIndex}>
            <span className="language-toggle-thumb" aria-hidden="true" />
            {TOGGLE_OPTIONS.map(/** Draw one language. */ (option) => (
                <button
                    key={option.language}
                    type="button"
                    className={option.language === current ? 'language-toggle-option is-selected' : 'language-toggle-option'}
                    aria-pressed={option.language === current}
                    onClick={() => { setLanguage(option.language); }}
                >
                    {option.code}
                </button>
            ))}
        </div>
    );
}
