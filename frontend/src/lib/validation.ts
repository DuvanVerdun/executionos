import { t } from '../i18n/i18n';

/** Return the first unmet password requirement, or an empty string. */
export function getPasswordError(password: string): string {
    if (password.length < 12) return t('auth.password.tooShort');
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]).+$/;
    if (!regex.test(password)) return t('auth.password.tooWeak');
    return '';
}
