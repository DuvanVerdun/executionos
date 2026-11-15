import { useNow } from '../hooks/useNow';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useT } from '../i18n/i18n';
import { useStore } from '../lib/store';
import { Header } from '../shared/Header';
import { Screen } from '../shared/Screen';
import { FollowingList } from './FollowingList';
import { isPollingProfileScreen, loadProfile, openOwnProfile, pollProfileScreen } from './profile';
import { ProfileCard } from './ProfileCard';
import { LockedProfile, ProfileData } from './ProfileData';
import { SettingsPanel } from './settings/SettingsPanel';
import { profileStore } from './state';

/** Draw a message that takes the place of the profile, with the button that follows from it. */
function ProfileMessage({ text, buttonLabel, onClick }: { text: string; buttonLabel: string; onClick: () => void }) {
    return (
        <div className="profile-message" role="alert">
            <p className="profile-message-text">{text}</p>
            <button type="button" className="profile-message-btn" onClick={onClick}>{buttonLabel}</button>
        </div>
    );
}

/** Draw the Profile screen: the card and the data of one profile, and the people the user follows. */
export function ProfileScreen() {
    const t = useT();
    const { view, profile, receivedAt, isBusy, panel } = useStore(profileStore);
    const isCounting = profile?.data?.live.state === 'working';
    const showsSettings = view === 'ready' && panel === 'settings' && profile?.relation === 'self';
    const now = useNow(isCounting);

    useDocumentEvent('visibilitychange', /** Refresh the profile and the list as soon as the tab is visible again. */ () => {
        if (!document.hidden && isPollingProfileScreen()) void pollProfileScreen();
    });

    return (
        <Screen name="profile" className="profile-screen">

            <Header screen="profile" className="plan-header profile-header" />

            <main className="profile-content">
                {view === 'loading' && (
                    <>
                        <div className="dashboard-skeleton profile-skeleton-card" role="status" aria-label={t('profile.loading')}></div>
                        <div className="profile-skeleton-data" aria-hidden="true">
                            <div className="dashboard-skeleton profile-skeleton-streak"></div>
                            <div className="dashboard-skeleton profile-skeleton-heatmap"></div>
                            <div className="dashboard-skeleton profile-skeleton-stats"></div>
                        </div>
                    </>
                )}
                {view === 'ready' && profile !== null && (
                    <>
                        <ProfileCard profile={profile} isBusy={isBusy} isSettingsOpen={showsSettings} secondsSinceAnswer={Math.max(0, now - receivedAt) / 1000} now={now} />
                        {showsSettings && <SettingsPanel />}
                        {!showsSettings && profile.data !== null && <ProfileData data={profile.data} />}
                        {!showsSettings && profile.data === null && (
                            <LockedProfile username={profile.username} isPrivate={profile.is_private} isRequested={profile.relation === 'requested'} />
                        )}
                    </>
                )}
                {view === 'error' && <ProfileMessage text={t('profile.error')} buttonLabel={t('common.retry')} onClick={() => { void loadProfile(); }} />}
                {view === 'notFound' && <ProfileMessage text={t('profile.notFound')} buttonLabel={t('profile.goToMine')} onClick={() => { void openOwnProfile(); }} />}
                {!showsSettings && <FollowingList />}
            </main>

        </Screen>
    );
}
