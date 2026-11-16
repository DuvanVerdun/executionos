import { languageStore, setLanguage, useT, type Language } from '../../i18n/i18n';
import { useStore } from '../../lib/store';
import { SettingsChoice } from './PrivacySection';
import { SettingsHeading } from './SettingsPanel';

/** The languages the user can choose, each written in its own language. */
const LANGUAGE_OPTIONS = [
    { language: 'es', name: 'Español' },
    { language: 'en', name: 'English' }
] as const satisfies readonly { language: Language; name: string }[];

/** Draw the choice of the language of the app. */
export function LanguageSection() {
    const t = useT();
    const { language } = useStore(languageStore);
    return (
        <div className="settings-form">
            <SettingsHeading title={t('settings.language')} text={t('settings.languageText')} />
            <div className="settings-choices" role="radiogroup" aria-label={t('settings.language')}>
                {LANGUAGE_OPTIONS.map(/** Draw the choice of one language. */ (option) => (
                    <SettingsChoice
                        key={option.language} title={option.name} isChecked={option.language === language}
                        onChoose={() => { setLanguage(option.language); }}
                    />
                ))}
            </div>
        </div>
    );
}
