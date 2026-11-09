// Pure input validation.

/** Return the first unmet password requirement, or an empty string. */
export function getPasswordError(password) {
    if (password.length < 12) return 'At least 12 characters.';
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#\$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]).+$/;
    if (!regex.test(password)) return 'Add uppercase, lowercase, a number and a symbol.';
    return '';
}
