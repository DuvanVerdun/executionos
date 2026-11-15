import { useT } from '../../i18n/i18n';
import { useStore } from '../../lib/store';
import { Avatar } from '../Avatar';
import { LockIcon } from '../icons';
import { SettingsError, SettingsHeading } from './SettingsPanel';
import { loadBlocked, unblockUser } from './settings';
import { settingsStore } from './state';

/** Draw the users that the user blocked, each with the button that unblocks them. */
export function BlockedSection() {
    const t = useT();
    const { blocked, blockedLoad } = useStore(settingsStore);
    return (
        <div className="settings-form">
            <SettingsHeading title={t('settings.blocked')} text={t('settings.blockedText')} />
            {blockedLoad === 'loading' && (
                <div className="settings-blocked-list" role="status" aria-label={t('settings.loading')}>
                    {[0, 1, 2].map(/** Draw one placeholder row. */ (key) => <div key={key} className="dashboard-skeleton settings-skeleton-row" aria-hidden="true"></div>)}
                </div>
            )}
            {blockedLoad === 'error' && <SettingsError onRetry={() => { void loadBlocked(); }} />}
            {blockedLoad === 'ready' && blocked.length === 0 && (
                <div className="settings-message">
                    <span className="settings-message-icon"><LockIcon /></span>
                    <p className="settings-message-title">{t('settings.blockedEmptyTitle')}</p>
                    <p className="settings-message-text">{t('settings.blockedEmptyText')}</p>
                </div>
            )}
            {blockedLoad === 'ready' && blocked.length > 0 && (
                <ul className="settings-blocked-list">
                    {blocked.map(/** Draw one blocked user. */ (user) => (
                        <li key={user.username} className="settings-blocked-row">
                            <Avatar username={user.username} size="small" />
                            <span className="settings-blocked-name">{user.username}</span>
                            <button type="button" className="following-action" onClick={() => { void unblockUser(user.username); }}>{t('settings.unblock')}</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
