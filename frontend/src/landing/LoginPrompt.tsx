import { useT } from '../i18n/i18n';
import { navigateTo } from '../shared/navigation';

/** Draw the line that sends someone with an account to Login. */
export function LoginPrompt() {
    const t = useT();
    return (
        <p className="landing-login-prompt">
            <span>{t('auth.register.switchPrompt')}</span>{' '}
            <button type="button" className="landing-login-link" onClick={() => { navigateTo('login', 'landing'); }}>
                {t('auth.register.switchToLogin')}
            </button>
        </p>
    );
}
