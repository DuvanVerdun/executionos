// Elements of the Register and Login screens.

import { getAllElements, getById, getElement } from '../lib/dom';

/** Elements of the Register screen. */
export const registerDom = {
    screen: getElement('.register-screen', HTMLDivElement),
    form: getById('register-form', HTMLFormElement),
    username: getById('register-username-input', HTMLInputElement),
    email: getById('register-email-input', HTMLInputElement),
    password: getById('register-password-input', HTMLInputElement),
    passwordError: getById('register-password-error-message', HTMLParagraphElement),
    emailError: getById('register-email-error-message', HTMLParagraphElement),
    usernameError: getById('register-username-error-message', HTMLParagraphElement),
    submitButton: getById('register-submit-btn', HTMLButtonElement),
    error: getById('register-error-message', HTMLParagraphElement),
    switchToLoginButton: getById('register-switch-to-login-btn', HTMLButtonElement)
};

/** Elements of the Login screen. */
export const loginDom = {
    screen: getElement('.login-screen', HTMLDivElement),
    form: getById('login-form', HTMLFormElement),
    usernameOrEmail: getById('login-username-or-email-input', HTMLInputElement),
    identifierError: getById('login-identifier-error-message', HTMLParagraphElement),
    passwordError: getById('login-password-error-message', HTMLParagraphElement),
    password: getById('login-password-input', HTMLInputElement),
    submitButton: getById('login-submit-btn', HTMLButtonElement),
    error: getById('login-error-message', HTMLParagraphElement),
    switchToRegisterButton: getById('login-switch-to-register-btn', HTMLButtonElement)
};

/** Every password visibility button. */
export const passwordButtons = getAllElements('.password-visibility-btn', HTMLButtonElement);
