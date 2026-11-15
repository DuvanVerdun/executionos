import type { ReactNode } from 'react';
import { handleLogout } from '../../auth/logout';
import { useDocumentEvent } from '../../hooks/useDocumentEvent';
import { useT, type TranslationKey } from '../../i18n/i18n';
import { useStore } from '../../lib/store';
import { confirmStore } from '../../shared/confirm';
import type { Account } from '../../types/social';
import { BlockedSection } from './BlockedSection';
import { FeedbackSection } from './FeedbackSection';
import { LanguageSection } from './LanguageSection';
import { PasswordSection } from './PasswordSection';
import { PrivacySection } from './PrivacySection';
import { closeSettings, loadAccount, selectSection } from './settings';
import { settingsStore, type SettingsSection } from './state';
import { UsernameSection } from './UsernameSection';

const SECTIONS = [
    { id: 'username', label: 'settings.username' },
    { id: 'password', label: 'settings.password' },
    { id: 'privacy', label: 'settings.privacy' },
    { id: 'blocked', label: 'settings.blocked' },
    { id: 'language', label: 'settings.language' },
    { id: 'feedback', label: 'settings.feedback' }
] as const satisfies readonly { id: SettingsSection; label: TranslationKey }[];

/** Draw the placeholders of a section that is loading. */
export function SettingsSkeleton() {
    const t = useT();
    return (
        <div className="settings-skeleton" role="status" aria-label={t('settings.loading')}>
            <div className="dashboard-skeleton settings-skeleton-title"></div>
            <div className="dashboard-skeleton settings-skeleton-field"></div>
            <div className="dashboard-skeleton settings-skeleton-text"></div>
            <div className="dashboard-skeleton settings-skeleton-button"></div>
        </div>
    );
}

/** Draw the message of a section that could not load, with the button that tries again. */
export function SettingsError({ onRetry }: { onRetry: () => void }) {
    const t = useT();
    return (
        <div className="settings-message" role="alert">
            <p className="settings-message-title">{t('settings.loadFailed')}</p>
            <button type="button" className="settings-retry-btn" onClick={onRetry}>{t('common.retry')}</button>
        </div>
    );
}

/** Draw the title of a section and what it is for. */
export function SettingsHeading({ title, text }: { title: string; text: string }) {
    return (
        <header className="settings-heading">
            <h2 className="settings-title">{title}</h2>
            <p className="settings-text">{text}</p>
        </header>
    );
}

/** Draw what needs the account: placeholders while it loads, an error, or the content for the account. */
function AccountGate({ children }: { children: (account: Account) => ReactNode }) {
    const { account, accountLoad } = useStore(settingsStore);
    if (accountLoad === 'error') return <SettingsError onRetry={() => { void loadAccount(); }} />;
    if (accountLoad === 'loading' || account === null) return <SettingsSkeleton />;
    return children(account);
}

/** Draw the option that the user chose. */
function SectionBody({ section }: { section: SettingsSection }) {
    switch (section) {
        case 'username': return <AccountGate>{(account) => <UsernameSection account={account} />}</AccountGate>;
        case 'password': return <PasswordSection />;
        case 'privacy': return <AccountGate>{(account) => <PrivacySection isPrivate={account.is_private} />}</AccountGate>;
        case 'blocked': return <BlockedSection />;
        case 'language': return <LanguageSection />;
        case 'feedback': return <FeedbackSection />;
    }
}

/** Draw the settings: a column of options, and the content of the one that the user chose. */
export function SettingsPanel() {
    const t = useT();
    const { section } = useStore(settingsStore);

    useDocumentEvent('keydown', /** Close the settings with Escape, unless the user is writing or answering a question. */ (event) => {
        const isWriting = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
        if (event.key === 'Escape' && !isWriting && confirmStore.get().request === null) closeSettings();
    });

    return (
        <section className="settings-panel" aria-label={t('settings.title')}>
            <nav className="settings-nav" aria-label={t('settings.title')}>
                <h2 className="settings-nav-title">{t('settings.title')}</h2>
                {SECTIONS.map(/** Draw the button of one option. */ (option) => (
                    <button
                        key={option.id} type="button"
                        className={option.id === section ? 'settings-nav-btn is-selected' : 'settings-nav-btn'}
                        aria-current={option.id === section ? 'page' : undefined}
                        onClick={() => { selectSection(option.id); }}
                    >
                        {t(option.label)}
                    </button>
                ))}
                <button type="button" className="settings-nav-btn is-danger settings-logout" onClick={() => { void handleLogout('profile'); }}>
                    {t('header.logout')}
                </button>
            </nav>
            <div className="settings-content">
                <SectionBody section={section} />
            </div>
        </section>
    );
}
