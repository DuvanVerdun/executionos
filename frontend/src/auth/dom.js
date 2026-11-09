// Elements of the Register and Login screens.

/** Elements of the Register screen. */
export const registerDom = {
    screen: document.querySelector('.register-screen'),
    form: document.getElementById('register-form'),
    username: document.getElementById('register-username-input'),
    email: document.getElementById('register-email-input'),
    password: document.getElementById('register-password-input'),
    passwordError: document.getElementById('register-password-error-message'),
    emailError: document.getElementById('register-email-error-message'),
    usernameError: document.getElementById('register-username-error-message'),
    submitButton: document.getElementById('register-submit-btn'),
    error: document.getElementById('register-error-message'),
    switchToLoginButton: document.getElementById('register-switch-to-login-btn')
};

/** Elements of the Login screen. */
export const loginDom = {
    screen: document.querySelector('.login-screen'),
    form: document.getElementById('login-form'),
    usernameOrEmail: document.getElementById('login-username-or-email-input'),
    identifierError: document.getElementById('login-identifier-error-message'),
    passwordError: document.getElementById('login-password-error-message'),
    password: document.getElementById('login-password-input'),
    submitButton: document.getElementById('login-submit-btn'),
    error: document.getElementById('login-error-message'),
    switchToRegisterButton: document.getElementById('login-switch-to-register-btn')
};

/** Every password visibility button. */
export const passwordButtons = document.querySelectorAll('.password-visibility-btn');
