import { useRef, useState, type SubmitEvent } from 'react';
import { routeToInitialScreen } from '../app/startup';
import { useStore } from '../lib/store';
import { Screen } from '../shared/Screen';
import { navigateTo } from '../shared/navigation';
import { login } from './api';
import { AuthField } from './AuthField';
import { authFormStore } from './forms-state';
import { setAuthenticatedUser } from './identity';

/** Draw the Login screen. */
export function LoginScreen() {
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
        setIdentifierError(missingIdentifier ? 'Enter your username or email.' : '');
        setPasswordError(missingPassword ? 'Enter your password.' : '');
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
                authFormStore.update({ loginError: 'Username, email or password is incorrect.' });
            } else {
                authFormStore.update({ loginError: "Couldn't log in. Please try again." });
            }
        } catch {
            authFormStore.update({ loginError: "Couldn't reach the server. Try again." });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Screen name="login" className="wordmark-centered-layout login-screen">
            <h1 className="wordmark">ExecutionOS</h1>
            <div className="login-card">
                <h2 className="card-header">Login</h2>

                <form id="login-form" noValidate aria-busy={isSubmitting ? true : undefined} onSubmit={(event) => { void handleLogin(event); }}>
                    <AuthField
                        id="login-username-or-email-input" label="Username or Email" type="text" autoComplete="username"
                        containerClass="login-username-or-email-input-container"
                        value={loginIdentifier}
                        onChange={(value) => { authFormStore.update({ loginIdentifier: value, loginError: '' }); setIdentifierError(''); }}
                        error={identifierError} errorId="login-identifier-error-message"
                        describedBy="login-identifier-error-message" inputRef={identifierRef}
                    />
                    <AuthField
                        id="login-password-input" label="Password" type="password" autoComplete="current-password"
                        containerClass="login-password-input-container"
                        value={loginPassword}
                        onChange={(value) => { authFormStore.update({ loginPassword: value, loginError: '' }); setPasswordError(''); }}
                        error={passwordError} errorId="login-password-error-message"
                        describedBy="login-password-error-message" inputRef={passwordRef}
                    />
                    <div className="login-error-and-button-container">
                        <p className="form-error-message auth-general-error" id="login-error-message" aria-live="polite">{loginError}</p>
                        <button type="submit" className="cta-button" id="login-submit-btn" disabled={isSubmitting}>
                            {isSubmitting ? 'Logging in...' : 'Login'}
                        </button>
                        <div className="switch-btn-container">
                            <button
                                type="button" className="switch-btn" id="login-switch-to-register-btn"
                                onClick={() => { authFormStore.update({ loginError: '' }); navigateTo('register', 'login'); }}
                            >
                                <span className="auth-switch-action">Create an account</span>
                            </button>
                        </div>
                    </div>
                </form>

            </div>
        </Screen>
    );
}
