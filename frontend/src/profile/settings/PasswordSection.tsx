import { useState, type SubmitEvent } from 'react';
import { AuthField } from '../../auth/AuthField';
import { useT } from '../../i18n/i18n';
import { SettingsHeading } from './SettingsPanel';
import { changePassword, type PasswordField } from './settings';

/** The message about the last attempt: the field it is about, and the text. */
interface PasswordMessage {
    field: PasswordField;
    text: string;
}

/** Draw the form that changes the password: the current one, the new one, and the new one again. */
export function PasswordSection() {
    const t = useT();
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [message, setMessage] = useState<PasswordMessage | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    /** Return the error of a field, or an empty text. */
    function errorOf(field: PasswordField): string {
        return message?.field === field ? message.text : '';
    }

    /** Edit a field, and forget the message about the last attempt. */
    function edit(setField: (value: string) => void, value: string): void {
        setField(value);
        setMessage(null);
        setIsSaved(false);
    }

    /** Send the new password and show how it went. */
    async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (isSaving) return;
        setIsSaving(true);
        setMessage(null);
        setIsSaved(false);
        const outcome = await changePassword(current, next, confirmation);
        setIsSaving(false);
        if (outcome.kind === 'error') {
            setMessage({ field: outcome.field, text: outcome.message });
            return;
        }
        setCurrent('');
        setNext('');
        setConfirmation('');
        setIsSaved(true);
    }

    return (
        <form className="settings-form" noValidate onSubmit={(event) => { void handleSubmit(event); }}>
            <SettingsHeading title={t('settings.password')} text={t('settings.passwordText')} />
            <div className="settings-fields">
                <AuthField
                    id="settings-current-password" label={t('settings.currentPassword')} type="password" autoComplete="current-password"
                    containerClass="settings-input-container" value={current} onChange={(value) => { edit(setCurrent, value); }}
                    error={errorOf('current')} errorId="settings-current-password-error" describedBy="settings-current-password-error"
                />
                <AuthField
                    id="settings-new-password" label={t('settings.newPassword')} type="password" autoComplete="new-password"
                    containerClass="settings-input-container" value={next} onChange={(value) => { edit(setNext, value); }}
                    error={errorOf('new')} errorId="settings-new-password-error" describedBy="settings-new-password-hint settings-new-password-error"
                    guidance={<p id="settings-new-password-hint" className="auth-password-guidance">{t('auth.register.passwordGuidance')}</p>}
                />
                <AuthField
                    id="settings-confirm-password" label={t('settings.confirmPassword')} type="password" autoComplete="new-password"
                    containerClass="settings-input-container" value={confirmation} onChange={(value) => { edit(setConfirmation, value); }}
                    error={errorOf('confirm')} errorId="settings-confirm-password-error" describedBy="settings-confirm-password-error"
                />
            </div>
            <p className={isSaved ? 'settings-status settings-success' : 'settings-status'} role="status" aria-live="polite">
                {isSaved ? t('settings.passwordChanged') : errorOf('form')}
            </p>
            <button type="submit" className="settings-submit-btn" disabled={isSaving}>
                {isSaving ? t('common.saving') : t('settings.changePassword')}
            </button>
        </form>
    );
}
