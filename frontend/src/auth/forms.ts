// Register, Login and Logout forms and the password buttons.

import { dashboardDom } from '../dashboard/dom';
import { getElement, getParentElement } from '../lib/dom';
import { getPasswordError } from '../lib/validation';
import { roomsDom } from '../rooms/dom';
import { planDom } from '../session/dom';
import { navigateTo } from '../shared/navigation';
import type { ScreenName } from '../types/screens';
import { login, logout, register } from './api';
import { loginDom, passwordButtons, registerDom } from './dom';
import { clearAuthenticatedUser, setAuthenticatedUser } from './identity';

/** Route the user to the right screen after a sign-in or a registration. */
type RouteAfterSignIn = (currentScreen: ScreenName) => Promise<void>;

let afterAuthenticated: RouteAfterSignIn = () => {
    throw new Error('initAuthForms must run before the forms are used.');
};

/** Set password visibility and the visibility button's accessible label. */
function setPasswordVisibility(passwordInput: HTMLInputElement, visibilityButton: HTMLButtonElement, visible: boolean): void {
    const showIcon = getElement('.password-show-icon', SVGElement, visibilityButton);
    const hideIcon = getElement('.password-hide-icon', SVGElement, visibilityButton);
    passwordInput.type = visible ? 'text' : 'password';
    showIcon.style.display = visible ? 'none' : 'block';
    hideIcon.style.display = visible ? 'block' : 'none';
    visibilityButton.ariaLabel = visible ? 'Hide password' : 'Show password';
}

/** Toggle a password field between concealed and visible text. */
function togglePasswordVisibility(passwordInput: HTMLInputElement, visibilityButton: HTMLButtonElement): void {
    setPasswordVisibility(passwordInput, visibilityButton, passwordInput.type === 'password');
}

/** Conceal a password and reset its visibility control. */
function hidePassword(passwordInput: HTMLInputElement): void {
    const visibilityButton = getElement('.password-visibility-btn', HTMLButtonElement, getParentElement(passwordInput));
    setPasswordVisibility(passwordInput, visibilityButton, false);
}

/** Clear validation messages and invalid-field markers on both auth forms. */
function clearAuthValidationFeedback(): void {
    [registerDom.form, loginDom.form].forEach(/** Clear validation feedback for an authentication form. */ (form) => {
        form.querySelectorAll('.form-error-message').forEach(/** Clear an authentication error message. */ (error) => {
            error.textContent = '';
        });
        form.querySelectorAll('[aria-invalid]').forEach(/** Remove an authentication input invalid marker. */ (input) => {
            input.removeAttribute('aria-invalid');
        });
    });
}

/** Display a field error and mark its input invalid. */
function showAuthFieldError(input: HTMLInputElement, errorElement: HTMLParagraphElement, message: string): void {
    errorElement.textContent = message;
    input.setAttribute('aria-invalid', 'true');
}

/** Validate registration fields and submit account creation with loading feedback. */
async function handleRegister(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (registerDom.submitButton.disabled) return;
    registerDom.error.textContent = '';
    [registerDom.emailError, registerDom.usernameError, registerDom.passwordError].forEach(/** Clear a registration field error. */ (error) => {
        error.textContent = '';
    });
    [registerDom.email, registerDom.username, registerDom.password].forEach(/** Remove a registration input invalid marker. */ (input) => {
        input.removeAttribute('aria-invalid');
    });
    const invalidInputs: HTMLInputElement[] = [];
    /** Record a registration field error and keep the invalid input. */
    const invalid = (input: HTMLInputElement, error: HTMLParagraphElement, message: string): void => {
        showAuthFieldError(input, error, message);
        invalidInputs.push(input);
    };
    const email = registerDom.email.value;
    if (!email) invalid(registerDom.email, registerDom.emailError, 'Enter your email.');
    else if (!email.includes('@')) invalid(registerDom.email, registerDom.emailError, 'Include @ in your email.');
    else if (!email.split('@')[1]) invalid(registerDom.email, registerDom.emailError, 'Add the address after @.');
    else if (registerDom.email.validity.typeMismatch) invalid(registerDom.email, registerDom.emailError, 'Enter a valid email, like name@example.com.');
    if (!registerDom.username.value) invalid(registerDom.username, registerDom.usernameError, 'Enter your username.');
    const passwordError = getPasswordError(registerDom.password.value);
    if (passwordError) invalid(registerDom.password, registerDom.passwordError, passwordError);
    const [firstInvalid] = invalidInputs;
    if (firstInvalid) {
        firstInvalid.focus();
        return;
    }
    registerDom.submitButton.disabled = true;
    registerDom.submitButton.textContent = 'Creating account...';
    registerDom.form.setAttribute('aria-busy', 'true');
    try {
        const result = await register(registerDom.username.value, email, registerDom.password.value);
        if (result.success === true) {
            setAuthenticatedUser(result);
            await afterAuthenticated('register');
        } else if (result.status === 409) {
            registerDom.error.textContent = 'Email or username is already in use.';
        } else {
            registerDom.error.textContent = "Couldn't create your account. Please try again.";
        }
    } catch (error) {
        registerDom.error.textContent = "Couldn't reach the server. Try again.";
    } finally {
        registerDom.submitButton.disabled = false;
        registerDom.submitButton.textContent = 'Register';
        registerDom.form.removeAttribute('aria-busy');
    }
}

/** Validate login fields and submit credentials with loading feedback. */
async function handleLogin(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (loginDom.submitButton.disabled) return;
    loginDom.error.textContent = '';
    loginDom.identifierError.textContent = '';
    loginDom.passwordError.textContent = '';
    loginDom.usernameOrEmail.removeAttribute('aria-invalid');
    loginDom.password.removeAttribute('aria-invalid');
    let firstInvalid: HTMLInputElement | null = null;
    if (!loginDom.usernameOrEmail.value) {
        showAuthFieldError(loginDom.usernameOrEmail, loginDom.identifierError, 'Enter your username or email.');
        firstInvalid = loginDom.usernameOrEmail;
    }
    if (!loginDom.password.value) {
        showAuthFieldError(loginDom.password, loginDom.passwordError, 'Enter your password.');
        firstInvalid ??= loginDom.password;
    }
    if (firstInvalid) {
        firstInvalid.focus();
        return;
    }
    loginDom.submitButton.disabled = true;
    loginDom.submitButton.textContent = 'Logging in...';
    loginDom.form.setAttribute('aria-busy', 'true');
    try {
        const result = await login(loginDom.usernameOrEmail.value, loginDom.password.value);
        if (result.success === true) {
            setAuthenticatedUser(result);
            await afterAuthenticated('login');
        } else if (result.status === 401) {
            loginDom.error.textContent = 'Username, email or password is incorrect.';
        } else {
            loginDom.error.textContent = "Couldn't log in. Please try again.";
        }
    } catch (error) {
        loginDom.error.textContent = "Couldn't reach the server. Try again.";
    } finally {
        loginDom.submitButton.disabled = false;
        loginDom.submitButton.textContent = 'Login';
        loginDom.form.removeAttribute('aria-busy');
    }
}

/** End the authenticated session and return to registration. */
async function handleLogout(currentScreen: ScreenName): Promise<void> {
    if (!confirm('Are you sure you want to log out?')) return;
    try {
        await logout();
        clearAuthenticatedUser();
        navigateTo('login', currentScreen);
    } catch (error) {
        alert('An unexpected network/server connection error occurred');
    }
}

/** Connect the Register and Login forms, the password buttons and the Logout buttons. The callback routes the user after a sign-in. */
export function initAuthForms(routeAfterSignIn: RouteAfterSignIn): void {
    afterAuthenticated = routeAfterSignIn;
    passwordButtons.forEach(/** Attach a password visibility handler. */ (button) => {
        button.addEventListener('click', /** Toggle the associated password field visibility. */ () => {
            const passwordInput = getElement('.input', HTMLInputElement, getParentElement(button));
            togglePasswordVisibility(passwordInput, button);
        });
    });
    registerDom.switchToLoginButton.addEventListener('click', /** Clear auth feedback and switch to Login. */ () => {
        clearAuthValidationFeedback();
        hidePassword(registerDom.password);
        navigateTo('login', 'register');
    });
    loginDom.switchToRegisterButton.addEventListener('click', /** Clear auth feedback and switch to Register. */ () => {
        clearAuthValidationFeedback();
        hidePassword(loginDom.password);
        navigateTo('register', 'login');
    });
    const fieldErrorPairs: [HTMLInputElement, HTMLParagraphElement][] = [[registerDom.email, registerDom.emailError],
        [registerDom.username, registerDom.usernameError],
        [registerDom.password, registerDom.passwordError],
        [loginDom.usernameOrEmail, loginDom.identifierError],
        [loginDom.password, loginDom.passwordError]];
    fieldErrorPairs.forEach(/** Attach an input handler to clear a field validation error. */ ([input, error]) => {
        input.addEventListener('input', /** Clear the edited field error and invalid marker. */ () => {
            error.textContent = '';
            input.removeAttribute('aria-invalid');
        });
    });
    [registerDom.email, registerDom.username, registerDom.password].forEach(/** Attach a handler to clear registration request errors. */ (input) => {
        input.addEventListener('input', /** Clear the registration request error after editing. */ () => { registerDom.error.textContent = ''; });
    });
    [loginDom.usernameOrEmail, loginDom.password].forEach(/** Attach a handler to clear login request errors. */ (input) => {
        input.addEventListener('input', /** Clear the login request error after editing. */ () => { loginDom.error.textContent = ''; });
    });
    registerDom.form.addEventListener('submit', handleRegister);
    loginDom.form.addEventListener('submit', handleLogin);
    planDom.logoutButton.addEventListener('click', /** Log out from Plan. */ () => handleLogout('plan'));
    dashboardDom.logoutButton.addEventListener('click', /** Log out from Dashboard. */ () => handleLogout('dashboard'));
    roomsDom.logoutButton.addEventListener('click', /** Log out from Rooms. */ () => handleLogout('rooms'));
}
