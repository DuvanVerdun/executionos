import { useRef, useState } from 'react';
import { useDocumentEvent } from '../hooks/useDocumentEvent';
import { useT } from '../i18n/i18n';
import { formatTimeAgo } from '../lib/dates';
import { ringFill, workedSeconds } from '../rooms/live-session';
import type { MemberState } from '../types/rooms';
import type { Profile } from '../types/social';
import { Avatar } from './Avatar';
import { CheckIcon, DotsIcon, GearIcon } from './icons';
import { blockViewedProfile, followViewedProfile, liveSessionOf, unfollowViewedProfile } from './profile';
import { closeSettings, openSettings } from './settings/settings';

interface ProfileCardProps {
    profile: Profile;
    isBusy: boolean;
    /** True while the settings show beside the card. */
    isSettingsOpen: boolean;
    /** The seconds since the profile came from the server. */
    secondsSinceAnswer: number;
    now: number;
}

/** Return the text that says what the user is doing: working, paused, or when they were last active. */
function useStatusText(profile: Profile, now: number): string | null {
    const t = useT();
    const data = profile.data;
    if (data === null) return null;
    if (data.live.state === 'working') return t('profile.statusWorking');
    if (data.live.state === 'paused') return t('profile.statusPaused');
    return data.last_activity_at === null ? t('profile.noActivity') : t('profile.activeAgo', { time: formatTimeAgo(data.last_activity_at, now) });
}

/** Draw the button that follows the user, or the state the follow is in. The user's own card has none. */
function FollowControl({ profile, isBusy }: { profile: Profile; isBusy: boolean }) {
    const t = useT();
    if (profile.relation === 'self') return null;
    if (profile.relation === 'following') {
        return <p className="profile-follow-state" role="status"><CheckIcon />{t('profile.followingButton')}</p>;
    }
    if (profile.relation === 'requested') {
        return <p className="profile-follow-state is-requested" role="status">{t('profile.requestSent')}</p>;
    }
    const label = profile.is_private ? t('profile.requestFollow') : profile.follows_you ? t('profile.followBack') : t('profile.follow');
    return (
        <button type="button" className="white-filled-button profile-follow-btn" disabled={isBusy} onClick={() => { void followViewedProfile(); }}>
            {label}
        </button>
    );
}

/** Draw the menu of someone else's profile: stop following, or take back the request, and block. */
function ProfileMenu({ profile, isBusy }: { profile: Profile; isBusy: boolean }) {
    const t = useT();
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useDocumentEvent('click', /** Close the menu when clicking outside it. */ (event) => {
        if (event.target instanceof Node && wrapperRef.current?.contains(event.target)) return;
        setIsOpen(false);
    }, isOpen);

    useDocumentEvent('keydown', /** Close the menu with Escape. */ (event) => {
        if (event.key === 'Escape') setIsOpen(false);
    }, isOpen);

    return (
        <div ref={wrapperRef} className="profile-menu-wrapper">
            <button
                type="button" className="profile-icon-btn" aria-label={t('profile.openMenu')}
                aria-haspopup="menu" aria-expanded={isOpen}
                onClick={() => { setIsOpen(!isOpen); }}
            >
                <DotsIcon />
            </button>
            {isOpen && (
                <div className="profile-menu" role="menu">
                    {profile.relation !== 'none' && (
                        <button type="button" role="menuitem" className="profile-menu-item" disabled={isBusy} onClick={() => { setIsOpen(false); void unfollowViewedProfile(); }}>
                            {profile.relation === 'following' ? t('profile.unfollow') : t('profile.cancelRequest')}
                        </button>
                    )}
                    <button type="button" role="menuitem" className="profile-menu-item is-danger" disabled={isBusy} onClick={() => { setIsOpen(false); void blockViewedProfile(); }}>
                        {t('profile.block')}
                    </button>
                </div>
            )}
        </div>
    );
}

/** Draw the card of a profile: the avatar, the username, what the user is doing, the counts, and the way to follow. The user's own card has the button of the settings. */
export function ProfileCard({ profile, isBusy, isSettingsOpen, secondsSinceAnswer, now }: ProfileCardProps) {
    const t = useT();
    const status = useStatusText(profile, now);
    const live = profile.data?.live ?? null;
    const state: MemberState = live?.state ?? 'not_working';
    const session = live === null ? null : liveSessionOf(live);
    const ring = session === null ? undefined : ringFill(workedSeconds(session, state, secondsSinceAnswer), session.target_time_seconds);
    return (
        <aside className="profile-card" aria-label={profile.username}>
            <div className="profile-card-menu">
                {profile.relation === 'self' ? (
                    <button
                        type="button" className="profile-icon-btn" aria-label={t('profile.settings')} aria-pressed={isSettingsOpen}
                        onClick={isSettingsOpen ? closeSettings : openSettings}
                    >
                        <GearIcon />
                    </button>
                ) : <ProfileMenu profile={profile} isBusy={isBusy} />}
            </div>
            <Avatar username={profile.username} size="large" state={state} {...(ring && { ring })} />
            <div className="profile-card-identity">
                <h1 className="profile-card-name">{profile.username}</h1>
                {profile.follows_you && <span className="room-pill">{t('profile.followsYou')}</span>}
                {status !== null && (
                    <p className="profile-card-status">
                        <span className={state === 'not_working' ? 'profile-status-dot' : 'profile-status-dot is-active'}></span>
                        {status}
                    </p>
                )}
            </div>
            <div className="profile-card-counts">
                <p className="profile-card-count"><span className="profile-card-count-value">{profile.followers_count}</span>{t('profile.followers')}</p>
                <p className="profile-card-count"><span className="profile-card-count-value">{profile.following_count}</span>{t('profile.following')}</p>
            </div>
            <FollowControl profile={profile} isBusy={isBusy} />
        </aside>
    );
}
