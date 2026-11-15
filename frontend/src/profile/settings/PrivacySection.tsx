import { useState } from 'react';
import { useT } from '../../i18n/i18n';
import { SettingsHeading } from './SettingsPanel';
import { changePrivacy } from './settings';

/** Draw one choice of a group: a radio with its title and what it means. */
export function SettingsChoice({ title, text, isChecked, isDisabled = false, onChoose }: {
    title: string;
    text?: string;
    isChecked: boolean;
    isDisabled?: boolean;
    onChoose: () => void;
}) {
    return (
        <button type="button" role="radio" aria-checked={isChecked} disabled={isDisabled} className="settings-choice" onClick={onChoose}>
            <span className="settings-choice-radio" aria-hidden="true"></span>
            <span className="settings-choice-body">
                <span className="settings-choice-title">{title}</span>
                {text !== undefined && <span className="settings-choice-text">{text}</span>}
            </span>
        </button>
    );
}

/** Draw the choice between a public and a private account. A change is saved at once. */
export function PrivacySection({ isPrivate }: { isPrivate: boolean }) {
    const t = useT();
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; isSuccess: boolean } | null>(null);

    /** Save the choice and show how it went. */
    async function choose(nextIsPrivate: boolean): Promise<void> {
        if (isSaving || nextIsPrivate === isPrivate) return;
        setIsSaving(true);
        setMessage(null);
        const outcome = await changePrivacy(nextIsPrivate);
        setIsSaving(false);
        setMessage(outcome.kind === 'saved' ? { text: t('settings.privacySaved'), isSuccess: true } : { text: outcome.message, isSuccess: false });
    }

    return (
        <div className="settings-form">
            <SettingsHeading title={t('settings.privacyTitle')} text={t('settings.privacyText')} />
            <div className="settings-choices" role="radiogroup" aria-label={t('settings.privacyTitle')}>
                <SettingsChoice
                    title={t('settings.public')} text={t('settings.publicText')} isChecked={!isPrivate} isDisabled={isSaving}
                    onChoose={() => { void choose(false); }}
                />
                <SettingsChoice
                    title={t('settings.private')} text={t('settings.privateText')} isChecked={isPrivate} isDisabled={isSaving}
                    onChoose={() => { void choose(true); }}
                />
            </div>
            <p className={message?.isSuccess === true ? 'settings-status settings-success' : 'settings-status settings-error'} role="status" aria-live="polite">
                {message?.text ?? ''}
            </p>
        </div>
    );
}
