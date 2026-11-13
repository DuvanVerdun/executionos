import { useRef, useState, type SubmitEvent } from 'react';
import { routeToInitialScreen } from '../app/startup';
import { useT } from '../i18n/i18n';
import { useStore } from '../lib/store';
import { navigateTo } from '../shared/navigation';
import { login } from './api';
import { AuthField } from './AuthField';
import { AuthShell } from './AuthShell';
import { authFormStore } from './forms-state';
import { setAuthenticatedUser } from './identity';

/** Draw the Login screen. */
export function LoginScreen() {
    const t = useT();
    const { loginIdentifier, loginPassword, loginError } = useStore(authFormStore);
    const [identifierError, setIdentifierError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const identifierRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    /** Validate login fields and submit credentials with loading feedback. */
    async function handleLogin(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (isSubmitting) return;
        authFormStore.update({ loginError: '' });
        const missingIdentifier = !loginIdentifier;
        const missingPassword = !loginPassword;
        setIdentifierError(missingIdentifier ? t('auth.login.identifierRequired') : '');
        setPasswordError(missingPassword ? t('auth.login.passwordRequired') : '');
        if (missingIdentifier || missingPassword) {
            (missingIdentifier ? identifierRef : passwordRef).current?.focus();
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await login(loginIdentifier, loginPassword);
            if (result.success) {
                setAuthenticatedUser(result);
                await routeToInitialScreen('login');
            } else if (result.status === 401) {
                authFormStore.update({ loginError: t('auth.login.wrongCredentials') });
            } else {
                authFormStore.update({ loginError: t('auth.login.failed') });
            }
        } catch {
            authFormStore.update({ loginError: t('common.serverUnreachable') });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <AuthShell screen="login">
            <div className="login-card">
                <h2 className="card-header">{t('auth.login.title')}</h2>

                <form id="login-form" noValidate aria-busy={isSubmitting ? true : undefined} onSubmit={(event) => { void handleLogin(event); }}>
                    <AuthField
                        id="login-username-or-email-input" label={t('auth.login.identifierLabel')} type="text" autoComplete="username"
                        containerClass="login-username-or-email-input-container"
                        value={loginIdentifier}
                        onChange={(value) => { authFormStore.update({ loginIdentifier: value, loginError: '' }); setIdentifierError(''); }}
                        error={identifierError} errorId="login-identifier-error-message"
                        describedBy="login-identifier-error-message" inputRef={identifierRef}
                    />
                    <AuthField
                        id="login-password-input" label={t('auth.passwordLabel')} type="password" autoComplete="current-password"
                        containerClass="login-password-input-container"
                        value={loginPassword}
                        onChange={(value) => { authFormStore.update({ loginPassword: value, loginError: '' }); setPasswordError(''); }}
                        error={passwordError} errorId="login-password-error-message"
                        describedBy="login-password-error-message" inputRef={passwordRef}
                    />
                    <div className="login-error-and-button-container">
                        <p className="form-error-message auth-general-error" id="login-error-message" aria-live="polite">{loginError}</p>
                        <button type="submit" className="cta-button" id="login-submit-btn" disabled={isSubmitting}>
                            {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
                        </button>
                        <div className="switch-btn-container">
                            <button
                                type="button" className="switch-btn" id="login-switch-to-register-btn"
                                onClick={() => { authFormStore.update({ loginError: '' }); navigateTo('register', 'login'); }}
                            >
                                <span className="auth-switch-action">{t('auth.login.switchToRegister')}</span>
                            </button>
                        </div>
                    </div>
                </form>

            </div>
        </AuthShell>
    );
}
