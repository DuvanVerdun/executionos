import { useRef, useState, type SubmitEvent } from 'react';
import { routeToInitialScreen } from '../app/startup';
import { getPasswordError } from '../lib/validation';
import { useStore } from '../lib/store';
import { Screen } from '../shared/Screen';
import { navigateTo } from '../shared/navigation';
import { register } from './api';
import { AuthField } from './AuthField';
import { authFormStore } from './forms-state';
import { setAuthenticatedUser } from './identity';

type FieldName = 'email' | 'username' | 'password';

const NO_ERRORS: Record<FieldName, string> = { email: '', username: '', password: '' };

/** Draw the Register screen. */
export function RegisterScreen() {
    const { registerEmail, registerUsername, registerPassword } = useStore(authFormStore);
    const [fieldErrors, setFieldErrors] = useState(NO_ERRORS);
    const [generalError, setGeneralError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const emailRef = useRef<HTMLInputElement>(null);
    const usernameRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);

    /** Clear the error of an edited field, and the general error. */
    function clearErrorsOf(field: FieldName): void {
        setFieldErrors({ ...fieldErrors, [field]: '' });
        setGeneralError('');
    }

    /** Validate registration fields and submit account creation with loading feedback. */
    async function handleRegister(event: SubmitEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (isSubmitting) return;
        setGeneralError('');
        const errors = { ...NO_ERRORS };
        const email = registerEmail;
        if (!email) errors.email = 'Enter your email.';
        else if (!email.includes('@')) errors.email = 'Include @ in your email.';
        else if (!email.split('@')[1]) errors.email = 'Add the address after @.';
        else if (emailRef.current?.validity.typeMismatch) errors.email = 'Enter a valid email, like name@example.com.';
        if (!registerUsername) errors.username = 'Enter your username.';
        const passwordError = getPasswordError(registerPassword);
        if (passwordError) errors.password = passwordError;
        setFieldErrors(errors);
        const firstInvalid = errors.email ? emailRef : errors.username ? usernameRef : errors.password ? passwordRef : null;
        if (firstInvalid) {
            firstInvalid.current?.focus();
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await register(registerUsername, email, registerPassword);
            if (result.success) {
                setAuthenticatedUser(result);
                await routeToInitialScreen('register');
            } else if (result.status === 409) {
                setGeneralError('Email or username is already in use.');
            } else {
                setGeneralError("Couldn't create your account. Please try again.");
            }
        } catch {
            setGeneralError("Couldn't reach the server. Try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Screen name="register" className="wordmark-centered-layout register-screen">
            <h1 className="wordmark">ExecutionOS</h1>
            <div className="register-card">
                <h2 className="card-header">Register</h2>

                <form id="register-form" noValidate aria-busy={isSubmitting ? true : undefined} onSubmit={(event) => { void handleRegister(event); }}>
                    <AuthField
                        id="register-email-input" label="Email" type="email" autoComplete="email"
                        containerClass="register-email-input-container"
                        value={registerEmail}
                        onChange={(value) => { authFormStore.update({ registerEmail: value }); clearErrorsOf('email'); }}
                        error={fieldErrors.email} errorId="register-email-error-message"
                        describedBy="register-email-error-message" inputRef={emailRef}
                    />
                    <AuthField
                        id="register-username-input" label="Username" type="text" autoComplete="username"
                        containerClass="register-username-input-container"
                        value={registerUsername}
                        onChange={(value) => { authFormStore.update({ registerUsername: value }); clearErrorsOf('username'); }}
                        error={fieldErrors.username} errorId="register-username-error-message"
                        describedBy="register-username-error-message" inputRef={usernameRef}
                    />
                    <AuthField
                        id="register-password-input" label="Password" type="password" autoComplete="new-password"
                        containerClass="register-password-input-container"
                        value={registerPassword}
                        onChange={(value) => { authFormStore.update({ registerPassword: value }); clearErrorsOf('password'); }}
                        error={fieldErrors.password} errorId="register-password-error-message"
                        describedBy="register-password-guidance register-password-error-message" inputRef={passwordRef}
                        guidance={<p className="auth-password-guidance" id="register-password-guidance">12+ characters: uppercase, lowercase, number and symbol.</p>}
                    />
                    <div className="register-error-and-button-container">
                        <p className="form-error-message auth-general-error" id="register-error-message" aria-live="polite">{generalError}</p>
                        <button type="submit" className="cta-button" id="register-submit-btn" disabled={isSubmitting}>
                            {isSubmitting ? 'Creating account...' : 'Register'}
                        </button>
                        <div className="switch-btn-container">
                            <button type="button" className="switch-btn" id="register-switch-to-login-btn" onClick={() => { navigateTo('login', 'register'); }}>
                                <span>Already have an account?</span> <span className="auth-switch-action">Log in</span>
                            </button>
                        </div>
                    </div>
                </form>

            </div>
        </Screen>
    );
}
