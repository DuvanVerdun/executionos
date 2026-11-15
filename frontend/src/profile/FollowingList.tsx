import { useRef, useState } from 'react';
import { useNow } from '../hooks/useNow';
import { useT } from '../i18n/i18n';
import { useStore } from '../lib/store';
import { ringFill, workedSeconds } from '../rooms/live-session';
import { LiveSessionCard, type Anchor } from '../shared/LiveSessionCard';
import type { FollowingEntry, SearchUser } from '../types/social';
import { Avatar } from './Avatar';
import { AddPersonIcon, CheckIcon, LockIcon, SearchIcon } from './icons';
import {
    answerFollowRequest, clearSearch, followFromSearch, liveSessionOf, loadFollowing, openProfile, setSearchQuery
} from './profile';
import { followingStore, profileStore, searchStore } from './state';

/** Draw the row of a person the user follows. Hovering the row of someone who is working shows their session. */
function FollowingRow({ entry, isSelected, secondsSinceAnswer }: { entry: FollowingEntry; isSelected: boolean; secondsSinceAnswer: number }) {
    const [anchor, setAnchor] = useState<Anchor | null>(null);
    const nameRef = useRef<HTMLSpanElement>(null);
    const session = liveSessionOf(entry.live);
    const worked = session ? workedSeconds(session, entry.live.state, secondsSinceAnswer) : 0;
    const ring = session ? ringFill(worked, session.target_time_seconds) : undefined;
    return (
        <button
            type="button"
            className={isSelected ? 'following-row is-selected' : 'following-row'}
            aria-current={isSelected ? 'page' : undefined}
            onClick={() => { void openProfile(entry.username); }}
            onMouseEnter={session ? (event) => {
                const row = event.currentTarget.getBoundingClientRect();
                const name = nameRef.current?.getBoundingClientRect();
                setAnchor({ x: name ? name.left + name.width / 2 : row.left + row.width / 2, y: row.top });
            } : undefined}
            onMouseLeave={() => { setAnchor(null); }}
        >
            <Avatar username={entry.username} size="small" state={entry.live.state} {...(ring && { ring })} />
            <span ref={nameRef} className="following-row-name">{entry.username}</span>
            <span className="following-row-streak"><span aria-hidden="true">🔥</span> {entry.streak}</span>
            {session && anchor !== null && <LiveSessionCard session={session} worked={worked} anchor={anchor} />}
        </button>
    );
}

/** Draw a request that someone sent, with the buttons to accept it or decline it. */
function RequestRow({ username, isBusy }: { username: string; isBusy: boolean }) {
    const t = useT();
    return (
        <div className="following-row following-request">
            <Avatar username={username} size="small" />
            <span className="following-row-name">{username}</span>
            <button
                type="button" className="following-request-btn is-accept" disabled={isBusy}
                aria-label={t('following.accept', { username })}
                onClick={() => { void answerFollowRequest(username, true); }}
            >
                <CheckIcon />
            </button>
            <button
                type="button" className="following-request-btn" disabled={isBusy}
                aria-label={t('following.decline', { username })}
                onClick={() => { void answerFollowRequest(username, false); }}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
        </div>
    );
}

/** Draw the row of a user the search found, with the button to follow them or the state of the follow. */
function SearchRow({ user, isPending }: { user: SearchUser; isPending: boolean }) {
    const t = useT();
    const canFollow = user.relation === 'none';
    const label = canFollow
        ? (user.is_private ? t('following.request') : t('following.follow'))
        : (user.relation === 'following' ? t('following.followingNow') : t('following.requested'));
    return (
        <div className="following-row following-result">
            <button type="button" className="following-result-open" onClick={() => { void openProfile(user.username); }}>
                <Avatar username={user.username} size="small" />
                <span className="following-row-name">{user.username}</span>
                {user.is_private && <span className="following-result-lock" role="img" aria-label={t('following.private')}><LockIcon /></span>}
            </button>
            {canFollow ? (
                <button type="button" className="following-action is-primary" disabled={isPending} onClick={() => { void followFromSearch(user.username); }}>{label}</button>
            ) : (
                <span className={user.relation === 'requested' ? 'following-action is-requested' : 'following-action'}>
                    {user.relation === 'following' && <CheckIcon />}{label}
                </span>
            )}
        </div>
    );
}

/** Draw a message in the middle of the list, with an optional icon. */
function ListMessage({ title, text, showIcon = false, children }: { title: string; text?: string; showIcon?: boolean; children?: React.ReactNode }) {
    return (
        <div className="following-message">
            {showIcon && <span className="following-message-icon"><AddPersonIcon /></span>}
            <p className="following-message-title">{title}</p>
            {text !== undefined && <p className="following-message-text">{text}</p>}
            {children}
        </div>
    );
}

/** Draw the search box. */
function SearchBox() {
    const t = useT();
    const { query } = useStore(searchStore);
    return (
        <div className={query === '' ? 'following-search' : 'following-search is-active'}>
            <SearchIcon />
            <input
                type="text" className="following-search-input" value={query} maxLength={50}
                placeholder={t('following.searchPlaceholder')} aria-label={t('following.searchPlaceholder')}
                onChange={(event) => { setSearchQuery(event.target.value); }}
                onKeyDown={(event) => { if (event.key === 'Escape') clearSearch(); }}
            />
            {query !== '' && (
                <button type="button" className="following-search-clear" aria-label={t('following.clearSearch')} onClick={clearSearch}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
            )}
        </div>
    );
}

/** Draw what is under the search box: the search results while the user searches, and the people they follow otherwise. */
function ListBody({ secondsSinceAnswer }: { secondsSinceAnswer: number }) {
    const t = useT();
    const { list, surface } = useStore(followingStore);
    const { viewing } = useStore(profileStore);
    const search = useStore(searchStore);
    if (search.status !== 'idle') {
        if (search.status === 'loading') return <div className="following-skeleton" role="status" aria-label={t('following.loading')}>{[0, 1, 2].map(/** Draw one placeholder row. */ (key) => <div key={key} className="dashboard-skeleton following-skeleton-row" aria-hidden="true"></div>)}</div>;
        if (search.status === 'error') return <ListMessage title={t('following.loadFailed')} />;
        if (search.results.length === 0) return <ListMessage title={t('following.noResultsTitle')} text={t('following.noResultsText')} />;
        return (
            <>
                <p className="following-label">{t('following.results')}</p>
                {search.results.map(/** Draw one result. */ (user) => <SearchRow key={user.username} user={user} isPending={search.pendingUsername === user.username} />)}
            </>
        );
    }
    if (surface === 'loading') {
        return <div className="following-skeleton" role="status" aria-label={t('following.loading')}>{[0, 1, 2, 3, 4].map(/** Draw one placeholder row. */ (key) => <div key={key} className="dashboard-skeleton following-skeleton-row" aria-hidden="true"></div>)}</div>;
    }
    if (surface === 'error') {
        return (
            <ListMessage title={t('following.loadFailed')}>
                <button type="button" className="following-retry-btn" onClick={() => { void loadFollowing(); }}>{t('common.retry')}</button>
            </ListMessage>
        );
    }
    if (list.following.length === 0) return <ListMessage showIcon title={t('following.emptyTitle')} text={t('following.emptyText')} />;
    return list.following.map(/** Draw one person. */ (entry) => <FollowingRow key={entry.username} entry={entry} isSelected={entry.username === viewing} secondsSinceAnswer={secondsSinceAnswer} />);
}

/** Draw the card on the right: the requests waiting for the user, the search, and the people they follow. */
export function FollowingList() {
    const t = useT();
    const { list, receivedAt, hasLoaded } = useStore(followingStore);
    const { isBusy } = useStore(profileStore);
    const isCounting = list.following.some(/** Find someone who is working. */ (entry) => entry.live.state === 'working');
    const now = useNow(isCounting);
    const secondsSinceAnswer = Math.max(0, now - receivedAt) / 1000;
    return (
        <section className="following-card" aria-label={t('following.title')}>
            {list.requests.length > 0 && (
                <div className="following-requests">
                    <h2 className="following-heading">{t('following.requests')}<span className="room-pill">{list.requests.length}</span></h2>
                    {list.requests.map(/** Draw one request. */ (request) => <RequestRow key={request.username} username={request.username} isBusy={isBusy} />)}
                </div>
            )}
            <h2 className="following-heading">{t('following.title')}{hasLoaded && <span className="room-pill">{list.following.length}</span>}</h2>
            <SearchBox />
            <div className="following-rows">
                <ListBody secondsSinceAnswer={secondsSinceAnswer} />
            </div>
        </section>
    );
}
