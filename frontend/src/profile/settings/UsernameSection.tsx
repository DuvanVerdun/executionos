import { useState, type SubmitEvent } from 'react';
import { AuthField } from '../../auth/AuthField';
import { useT } from '../../i18n/i18n';
import type { Account } from '../../types/social';
import { SettingsHeading } from './SettingsPanel';
import { changeUsername, formatUsernameChangeDay, isUsernameLocked, USERNAME_MAX_LENGTH } from './settings';

/** A message about the last attempt, and whether it is good news. */
interface FormMessage {
    text: string;
    isSuccess: boolean;
}

/** Draw the form that changes the username. It can change once every 30 days, and the form says when it can change again. */
export function UsernameSection({ account }: { account: Account }) {
    const t = useT();
    const [value, setValue] = useState(account.username);
    const [message, setMessage] = useState<FormMessage | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [openedAt] = useState(Date.now);
    const nextChangeAt = account.username_next_change_at;
    const isLocked = nextChangeAt !== null && isUsernameLocked(account, openedAt);

    /** Send the new username and show how it went. */
    async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (isSaving || isLocked) return;
        setIsSaving(true);
        setMessage(null);
        const outcome = await changeUsername(value);
        setIsSaving(false);
        if (outcome.kind === 'saved') setMessage({ text: t('settings.usernameSaved'), isSuccess: true });
        else setMessage({ text: outcome.message, isSuccess: false });
    }

    return (
        <form className="settings-form" noValidate onSubmit={(event) => { void handleSubmit(event); }}>
            <SettingsHeading title={t('settings.username')} text={t('settings.usernameText')} />
            <div className="settings-fields">
                <AuthField
                    id="settings-username" label={t('settings.username')} type="text" autoComplete="username"
                    containerClass="settings-input-container" value={value} disabled={isLocked}
                    onChange={(next) => { setValue(next.slice(0, USERNAME_MAX_LENGTH + 1)); setMessage(null); }}
                    error={message !== null && !message.isSuccess ? message.text : ''} errorId="settings-username-error"
                    describedBy="settings-username-hint settings-username-error"
                    guidance={
                        <>
                            {message?.isSuccess === true && <p className="auth-password-guidance settings-success">{t('settings.usernameSaved')}</p>}
                            <p id="settings-username-hint" className="auth-password-guidance">
                                {isLocked ? t('settings.usernameLocked', { date: formatUsernameChangeDay(nextChangeAt) }) : t('settings.usernameHint')}
                            </p>
                        </>
                    }
                />
            </div>
            <button type="submit" className="settings-submit-btn" disabled={isSaving || isLocked}>
                {isSaving ? t('common.saving') : t('common.save')}
            </button>
        </form>
    );
}
