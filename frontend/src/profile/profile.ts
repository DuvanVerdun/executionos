import { authStore } from '../auth/state';
import { SEARCH_DEBOUNCE_MS, SEARCH_MIN_LENGTH, SOCIAL_POLL_INTERVAL_MS } from '../config';
import { t } from '../i18n/i18n';
import { confirmAction } from '../shared/confirm';
import { setFloatingMessage } from '../shared/floating-message';
import { loadStreak } from '../streak/streak';
import type { ApiResult } from '../types/api';
import type { LiveState, Relation } from '../types/social';
import type { LiveSession } from '../types/rooms';
import {
    deleteFollow, deleteFollowRequest, fetchFollowing, fetchProfile, fetchUserSearch,
    postAcceptFollowRequest, putBlock, putFollow, type FollowStatus
} from './api';
import { followingStore, profileStore, searchStore } from './state';

/** Grow with every load and every screen exit, so older results can be ignored. */
let profileGeneration = 0;
let followingGeneration = 0;
let searchGeneration = 0;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let searchTimer: ReturnType<typeof setTimeout> | null = null;

/** Return the session of a live state in the shape the rooms use, or null when the user is not working. */
export function liveSessionOf(live: LiveState): LiveSession | null {
    if (live.state === 'not_working' || live.worked_seconds === null || live.target_seconds === null) return null;
    return { mission: live.mission, target_time_seconds: live.target_seconds, actual_time_seconds: live.worked_seconds };
}

/** Return the relation that a follow leaves between the user and someone else. */
export function relationOfFollow(status: FollowStatus): Exclude<Relation, 'self'> {
    return status === 'accepted' ? 'following' : 'requested';
}

/** Return the username whose profile shows. */
function viewedUsername(): string {
    return profileStore.get().viewing ?? authStore.get().username;
}

/** Load the profile that shows. A silent load keeps what is on screen while it runs. */
export async function loadProfile({ silent = false }: { silent?: boolean } = {}): Promise<void> {
    const generation = ++profileGeneration;
    profileStore.update({ isLoading: true });
    if (!silent) profileStore.update({ view: 'loading', profile: null });
    try {
        const result = await fetchProfile(viewedUsername());
        if (generation !== profileGeneration) return;
        if (result.success) {
            profileStore.update({ view: 'ready', profile: result.profile, receivedAt: Date.now() });
        } else if (result.status === 404) {
            profileStore.update({ view: 'notFound', profile: null });
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        if (generation !== profileGeneration) return;
        console.error('Profile loading error:', error);
        if (!silent || profileStore.get().profile === null) profileStore.update({ view: 'error', profile: null });
    } finally {
        if (generation === profileGeneration) profileStore.update({ isLoading: false });
    }
}

/** Load the requests and the people the user follows. A silent load keeps what is on screen while it runs. */
export async function loadFollowing({ silent = false }: { silent?: boolean } = {}): Promise<void> {
    const generation = ++followingGeneration;
    followingStore.update({ isLoading: true });
    if (!silent && !followingStore.get().hasLoaded) followingStore.update({ surface: 'loading' });
    try {
        const result = await fetchFollowing();
        if (generation !== followingGeneration) return;
        if (!result.success) throw new Error(result.error);
        followingStore.update({
            list: { requests: result.requests, following: result.following },
            surface: 'ready', hasLoaded: true, receivedAt: Date.now()
        });
    } catch (error) {
        if (generation !== followingGeneration) return;
        console.error('Following loading error:', error);
        if (!silent || !followingStore.get().hasLoaded) followingStore.update({ surface: 'error' });
    } finally {
        if (generation === followingGeneration) followingStore.update({ isLoading: false });
    }
}

/** Refresh the profile and the list on a timer, skipping hidden tabs and overlapping requests. */
export async function pollProfileScreen(): Promise<void> {
    if (document.hidden) return;
    const tasks: Promise<void>[] = [];
    if (!profileStore.get().isLoading) tasks.push(loadProfile({ silent: true }));
    if (!followingStore.get().isLoading) tasks.push(loadFollowing({ silent: true }));
    await Promise.all(tasks);
}

/** Whether the Profile screen is being polled now. */
export function isPollingProfileScreen(): boolean {
    return pollTimer !== null;
}

/** Stop polling the Profile screen. */
function stopPolling(): void {
    clearInterval(pollTimer ?? undefined);
    pollTimer = null;
}

/** Stop the search, and forget what was written in it. */
export function clearSearch(): void {
    clearTimeout(searchTimer ?? undefined);
    searchTimer = null;
    searchGeneration += 1;
    searchStore.set({ query: '', status: 'idle', results: [], pendingUsername: null });
}

/** Show the user's own profile, and load it. */
export async function openOwnProfile(): Promise<void> {
    clearSearch();
    profileStore.update({ viewing: null });
    await loadProfile();
}

/** Show the profile of someone, and load it. */
export async function openProfile(username: string): Promise<void> {
    if (username === authStore.get().username) {
        await openOwnProfile();
        return;
    }
    profileStore.update({ viewing: username });
    await loadProfile();
}

/** Prepare the Profile screen after it shows: the user's own profile, the people they follow, and the refresh timer. */
export async function enterProfileScreen(): Promise<void> {
    clearSearch();
    profileStore.update({ viewing: null });
    stopPolling();
    pollTimer = setInterval(() => { void pollProfileScreen(); }, SOCIAL_POLL_INTERVAL_MS);
    void loadStreak('profile');
    await Promise.all([loadProfile(), loadFollowing()]);
}

/** Stop everything the Profile screen started. */
export function leaveProfileScreen(): void {
    stopPolling();
    profileGeneration += 1;
    followingGeneration += 1;
    profileStore.update({ isLoading: false, isBusy: false });
    followingStore.update({ isLoading: false });
    clearSearch();
}

/** Forget the profiles and the list. Used when the user signs out or reaches Login. */
export function resetProfileData(): void {
    leaveProfileScreen();
    profileStore.update({ viewing: null, view: 'loading', profile: null });
    followingStore.update({ list: { requests: [], following: [] }, surface: 'loading', hasLoaded: false });
}

/** Refresh what a change of the follows changed. */
async function refreshAfterChange(): Promise<void> {
    await Promise.all([loadProfile({ silent: true }), loadFollowing({ silent: true })]);
}

/** Run a change of the follows for the profile that shows. Tell the user when it fails. Return whether it worked. */
async function runProfileChange(change: () => Promise<ApiResult<object>>): Promise<boolean> {
    if (profileStore.get().isBusy) return false;
    profileStore.update({ isBusy: true });
    try {
        const result = await change();
        if (!result.success) throw new Error(result.error);
        return true;
    } catch (error) {
        console.error('Profile change error:', error);
        setFloatingMessage(t('profile.actionFailed'), { error: true });
        return false;
    } finally {
        profileStore.update({ isBusy: false });
    }
}

/** Follow the person whose profile shows, or ask them when their account is private. */
export async function followViewedProfile(): Promise<void> {
    if (await runProfileChange(() => putFollow(viewedUsername()))) await refreshAfterChange();
}

/** Stop following the person whose profile shows, or take back the request. */
export async function unfollowViewedProfile(): Promise<void> {
    if (await runProfileChange(() => deleteFollow(viewedUsername()))) await refreshAfterChange();
}

/** After the user confirms, block the person whose profile shows and go back to the user's own profile. */
export async function blockViewedProfile(): Promise<void> {
    const username = viewedUsername();
    const confirmed = await confirmAction({
        message: t('profile.blockConfirm', { username }),
        details: [t('profile.blockDetailFind'), t('profile.blockDetailFollows')],
        confirmLabel: t('profile.block')
    });
    if (!confirmed) return;
    if (!await runProfileChange(() => putBlock(username))) return;
    profileStore.update({ viewing: null });
    await Promise.all([loadProfile(), loadFollowing({ silent: true })]);
}

/** Accept the request of a user, or decline it. */
export async function answerFollowRequest(username: string, accept: boolean): Promise<void> {
    const change = accept ? postAcceptFollowRequest : deleteFollowRequest;
    if (await runProfileChange(() => change(username))) await refreshAfterChange();
}

/** Look for users whose username starts with the text. The server is asked once the user stops writing. */
export function setSearchQuery(query: string): void {
    clearTimeout(searchTimer ?? undefined);
    searchTimer = null;
    const generation = ++searchGeneration;
    const text = query.trim();
    if (text.length < SEARCH_MIN_LENGTH) {
        searchStore.update({ query, status: 'idle', results: [] });
        return;
    }
    searchStore.update({ query, status: 'loading' });
    searchTimer = setTimeout(() => { void runSearch(text, generation); }, SEARCH_DEBOUNCE_MS);
}

/** Ask the server for the users that match, unless the user kept writing meanwhile. */
async function runSearch(text: string, generation: number): Promise<void> {
    try {
        const result = await fetchUserSearch(text);
        if (generation !== searchGeneration) return;
        if (!result.success) throw new Error(result.error);
        searchStore.update({ status: 'ready', results: result.users });
    } catch (error) {
        if (generation !== searchGeneration) return;
        console.error('Search error:', error);
        searchStore.update({ status: 'error', results: [] });
    }
}

/** Follow a user who the search found, or ask them when their account is private. */
export async function followFromSearch(username: string): Promise<void> {
    if (searchStore.get().pendingUsername !== null) return;
    searchStore.update({ pendingUsername: username });
    try {
        const result = await putFollow(username);
        if (!result.success) throw new Error(result.error);
        const relation = relationOfFollow(result.follow_status);
        searchStore.update({
            results: searchStore.get().results.map(/** Mark the user who was followed. */ (user) => (user.username === username ? { ...user, relation } : user))
        });
        await refreshAfterChange();
    } catch (error) {
        console.error('Follow error:', error);
        setFloatingMessage(t('profile.actionFailed'), { error: true });
    } finally {
        searchStore.update({ pendingUsername: null });
    }
}
