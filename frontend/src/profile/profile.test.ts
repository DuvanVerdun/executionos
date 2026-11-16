import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../auth/state';
import { SEARCH_DEBOUNCE_MS } from '../config';
import { answerConfirm, confirmStore } from '../shared/confirm';
import { floatingMessageStore } from '../shared/floating-message';
import { streakStore } from '../streak/streak';
import { deferred, fakeBackendByPath, pathOf, type FakeAnswer } from '../test/network';
import { following, profile } from './fixtures';
import {
    answerFollowRequest, blockViewedProfile, clearSearch, enterProfileScreen, followFromSearch, followViewedProfile,
    isPollingProfileScreen, leaveProfileScreen, loadFollowing, loadProfile, openOwnProfile, openProfile,
    pollProfileScreen, relationOfFollow, resetProfileData, setSearchQuery, unfollowViewedProfile
} from './profile';
import { followingStore, profileCache, profileStore, searchStore } from './state';

/** The answers of a fake backend by "METHOD path", where the path has no query. A request without an answer fails with 500. */
function backend(routes: Record<string, FakeAnswer>) {
    return fakeBackendByPath((path, init) => routes[`${init?.method ?? 'GET'} ${path.split('?')[0] ?? ''}`] ?? { status: 500 });
}

/** List the requests a fake backend got as "METHOD path". */
function requests(fake: ReturnType<typeof backend>): string[] {
    return fake.mock.calls.map(/** Describe one request. */ ([url, init]) => `${init?.method ?? 'GET'} ${pathOf(url).split('?')[0] ?? ''}`);
}

/** Return the text that the first search request asked for. */
function queryOf(fake: ReturnType<typeof backend>): string | null {
    const url = fake.mock.calls[0]?.[0];
    return url === undefined ? null : new URL(pathOf(url), 'https://x.test/').searchParams.get('q');
}

const OK: FakeAnswer = { status: 200, body: { success: true } };
const LUCIA: FakeAnswer = { status: 200, body: { success: true, profile: profile() } };
const LIST: FakeAnswer = { status: 200, body: { success: true, requests: [{ username: 'ana' }], following: [following('lucia')] } };

beforeEach(() => {
    authStore.update({ accessToken: 'token', userId: 1, username: 'duvan' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('loading a profile', () => {
    it('shows the profile of the user when no one else is chosen', async () => {
        const fake = backend({ 'GET users/duvan': { status: 200, body: { success: true, profile: profile({ username: 'duvan', relation: 'self' }) } } });
        await loadProfile();
        expect(requests(fake)).toEqual(['GET users/duvan']);
        expect(profileStore.get()).toMatchObject({ view: 'ready', isLoading: false });
        expect(profileStore.get().profile?.username).toBe('duvan');
    });

    it('says the user is not found when the server answers 404', async () => {
        backend({ 'GET users/duvan': { status: 404, body: { success: false, error: 'User not available' } } });
        await loadProfile();
        expect(profileStore.get()).toMatchObject({ view: 'notFound', profile: null });
    });

    it('shows an error when the server fails, and keeps the profile on screen when a silent refresh fails', async () => {
        backend({ 'GET users/duvan': LUCIA });
        await loadProfile();
        backend({});
        await loadProfile({ silent: true });
        expect(profileStore.get().view).toBe('ready');
        await loadProfile();
        expect(profileStore.get()).toMatchObject({ view: 'error', profile: null });
    });

    it('ignores an answer that arrives after a newer load', async () => {
        const slow = deferred<Response>();
        const fake = vi.fn<typeof fetch>()
            .mockReturnValueOnce(slow.promise)
            .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, profile: profile({ username: 'new' }) }), { status: 200 }));
        vi.stubGlobal('fetch', fake);
        const first = loadProfile();
        await loadProfile();
        slow.resolve(new Response(JSON.stringify({ success: true, profile: profile({ username: 'old' }) }), { status: 200 }));
        await first;
        expect(profileStore.get().profile?.username).toBe('new');
    });

    it('opens the profile of someone else, and the own one when the username is the own', async () => {
        const fake = backend({ 'GET users/lucia': LUCIA, 'GET users/duvan': LUCIA });
        await openProfile('lucia');
        expect(profileStore.get().viewing).toBe('lucia');
        await openProfile('duvan');
        expect(profileStore.get().viewing).toBeNull();
        expect(requests(fake)).toEqual(['GET users/lucia', 'GET users/duvan']);
    });

    it('goes back to the own profile and clears the search', async () => {
        backend({ 'GET users/duvan': LUCIA });
        profileStore.update({ viewing: 'lucia' });
        searchStore.update({ query: 'lu', status: 'ready' });
        await openOwnProfile();
        expect(profileStore.get().viewing).toBeNull();
        expect(searchStore.get().query).toBe('');
    });
});

describe('opening a profile that was loaded before', () => {
    it('shows it at once while the server refreshes it, and shows placeholders for one that never loaded', async () => {
        backend({ 'GET users/lucia': LUCIA, 'GET users/mateo': { status: 200, body: { success: true, profile: profile({ username: 'mateo' }) } } });
        const first = openProfile('lucia');
        expect(profileStore.get()).toMatchObject({ view: 'loading', profile: null });
        await first;
        await openProfile('mateo');
        const slow = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(slow.promise));
        const second = openProfile('lucia');
        expect(profileStore.get()).toMatchObject({ view: 'ready', viewing: 'lucia' });
        expect(profileStore.get().profile?.username).toBe('lucia');
        slow.resolve(new Response(JSON.stringify({ success: true, profile: profile({ followers_count: 9 }) }), { status: 200 }));
        await second;
        expect(profileStore.get().profile?.followers_count).toBe(9);
    });

    it('keeps showing it when the refresh fails, and says the user is not found when the refresh says so', async () => {
        backend({ 'GET users/lucia': LUCIA });
        await openProfile('lucia');
        backend({});
        await openProfile('lucia');
        expect(profileStore.get()).toMatchObject({ view: 'ready', profile: { username: 'lucia' } });
        backend({ 'GET users/lucia': { status: 404, body: { success: false } } });
        await openProfile('lucia');
        expect(profileStore.get().view).toBe('notFound');
    });

    it('keeps the own profile while the user opens other screens and comes back', async () => {
        backend({ 'GET users/duvan': { status: 200, body: { success: true, profile: profile({ username: 'duvan', relation: 'self' }) } }, 'GET following': LIST, 'GET streak': { status: 500 } });
        await enterProfileScreen();
        leaveProfileScreen();
        const slow = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(slow.promise));
        const entering = enterProfileScreen();
        expect(profileStore.get()).toMatchObject({ view: 'ready', profile: { username: 'duvan' } });
        slow.resolve(new Response('{}', { status: 500 }));
        await entering;
        leaveProfileScreen();
    });

    it('forgets the profiles that were loaded when the user signs out', async () => {
        backend({ 'GET users/lucia': LUCIA });
        await openProfile('lucia');
        expect(profileCache.size).toBe(1);
        resetProfileData();
        expect(profileCache.size).toBe(0);
    });
});

describe('loading the people the user follows', () => {
    it('shows the requests and the people', async () => {
        backend({ 'GET following': LIST });
        await loadFollowing();
        expect(followingStore.get()).toMatchObject({ surface: 'ready', hasLoaded: true });
        expect(followingStore.get().list.requests).toEqual([{ username: 'ana' }]);
        expect(followingStore.get().list.following.map(/** Read a username. */ (entry) => entry.username)).toEqual(['lucia']);
    });

    it('shows an error on a first load that fails, and keeps the list when a refresh fails', async () => {
        backend({});
        await loadFollowing();
        expect(followingStore.get().surface).toBe('error');
        backend({ 'GET following': LIST });
        await loadFollowing();
        backend({});
        await loadFollowing({ silent: true });
        expect(followingStore.get().surface).toBe('ready');
    });
});

describe('the Profile screen', () => {
    it('loads the profile, the list and the streak when it opens, and refreshes them on a timer', async () => {
        vi.useFakeTimers();
        const fake = backend({ 'GET users/duvan': LUCIA, 'GET following': LIST, 'GET streak': { status: 500 } });
        await enterProfileScreen();
        expect(requests(fake).sort()).toEqual(['GET following', 'GET streak', 'GET users/duvan']);
        expect(isPollingProfileScreen()).toBe(true);
        fake.mockClear();
        await vi.advanceTimersByTimeAsync(15000);
        expect(requests(fake).sort()).toEqual(['GET following', 'GET users/duvan']);
        leaveProfileScreen();
        fake.mockClear();
        await vi.advanceTimersByTimeAsync(30000);
        expect(fake).not.toHaveBeenCalled();
        expect(isPollingProfileScreen()).toBe(false);
        vi.useRealTimers();
        expect(streakStore.get().view).not.toBe('idle');
    });

    it('does not refresh in a hidden tab', async () => {
        const fake = backend({ 'GET users/duvan': LUCIA, 'GET following': LIST });
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        await pollProfileScreen();
        expect(fake).not.toHaveBeenCalled();
    });

    it('forgets the profile and the list', async () => {
        backend({ 'GET users/duvan': LUCIA, 'GET following': LIST });
        await Promise.all([loadProfile(), loadFollowing()]);
        resetProfileData();
        expect(profileStore.get()).toMatchObject({ profile: null, view: 'loading' });
        expect(followingStore.get()).toMatchObject({ hasLoaded: false, list: { requests: [], following: [] } });
    });
});

describe('changing the follows from a profile', () => {
    beforeEach(() => {
        profileStore.update({ viewing: 'lucia', profile: profile({ relation: 'none', data: null }) });
    });

    it('follows, and refreshes the profile and the list', async () => {
        const fake = backend({ 'PUT users/lucia/follow': { status: 200, body: { success: true, follow_status: 'accepted' } }, 'GET users/lucia': LUCIA, 'GET following': LIST });
        await followViewedProfile();
        expect(requests(fake)).toEqual(['PUT users/lucia/follow', 'GET users/lucia', 'GET following']);
        expect(profileStore.get().isBusy).toBe(false);
    });

    it('unfollows', async () => {
        const fake = backend({ 'DELETE users/lucia/follow': OK, 'GET users/lucia': LUCIA, 'GET following': LIST });
        await unfollowViewedProfile();
        expect(requests(fake)).toContain('DELETE users/lucia/follow');
    });

    it.each([
        ['a public account', false, 'following'],
        ['a private account', true, 'requested']
    ] as const)('shows the follow of %s before the server answers', async (_name, isPrivate, relation) => {
        profileStore.update({ profile: profile({ relation: 'none', is_private: isPrivate, data: null }) });
        const slow = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(slow.promise));
        const done = followViewedProfile();
        expect(profileStore.get().profile?.relation).toBe(relation);
        vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')));
        slow.resolve(new Response(JSON.stringify({ success: true, follow_status: 'accepted' }), { status: 200 }));
        await done;
    });

    it('shows the unfollow before the server answers, and locks the data', async () => {
        profileStore.update({ profile: profile({ relation: 'following' }) });
        const slow = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(slow.promise));
        const done = unfollowViewedProfile();
        expect(profileStore.get().profile).toMatchObject({ relation: 'none', data: null });
        slow.resolve(new Response(JSON.stringify({ success: false }), { status: 500 }));
        await done;
    });

    it('brings the profile back, tells the user, and refreshes nothing when the change fails', async () => {
        const shown = profile({ relation: 'none', data: null });
        profileStore.update({ profile: shown });
        const fake = backend({ 'PUT users/lucia/follow': { status: 500, body: { success: false } } });
        await followViewedProfile();
        expect(requests(fake)).toEqual(['PUT users/lucia/follow']);
        expect(profileStore.get().profile).toEqual(shown);
        expect(floatingMessageStore.get()).toMatchObject({ message: "That didn't work. Try again.", error: true });
        expect(profileStore.get().isBusy).toBe(false);
    });

    it('asks again for the search that shows, so its results show the new follow', async () => {
        profileStore.update({ profile: profile({ relation: 'none', data: null }) });
        searchStore.update({ query: 'lu', status: 'ready', results: [{ username: 'lucia', is_private: false, relation: 'none' }] });
        backend({
            'PUT users/lucia/follow': { status: 200, body: { success: true, follow_status: 'accepted' } },
            'GET users/lucia': LUCIA, 'GET following': LIST,
            'GET user-search': { status: 200, body: { success: true, users: [{ username: 'lucia', is_private: false, relation: 'following' }] } }
        });
        await followViewedProfile();
        expect(searchStore.get().results[0]?.relation).toBe('following');
    });

    it('keeps the results of the search when asking again fails', async () => {
        profileStore.update({ profile: profile({ relation: 'none', data: null }) });
        const results = [{ username: 'lucia', is_private: false, relation: 'none' as const }];
        searchStore.update({ query: 'lu', status: 'ready', results });
        backend({ 'PUT users/lucia/follow': { status: 200, body: { success: true, follow_status: 'accepted' } }, 'GET users/lucia': LUCIA, 'GET following': LIST });
        await followViewedProfile();
        expect(searchStore.get()).toMatchObject({ status: 'ready', results });
    });

    it('tells the user when the change fails, and refreshes nothing', async () => {
        const fake = backend({ 'PUT users/lucia/follow': { status: 500, body: { success: false } } });
        profileStore.update({ profile: profile({ relation: 'none', data: null }) });
        await followViewedProfile();
        expect(requests(fake)).toEqual(['PUT users/lucia/follow']);
    });

    it('does not start a second change while one runs', async () => {
        const slow = deferred<Response>();
        const fake = vi.fn<typeof fetch>().mockReturnValue(slow.promise);
        vi.stubGlobal('fetch', fake);
        const first = followViewedProfile();
        await followViewedProfile();
        expect(fake).toHaveBeenCalledTimes(1);
        slow.resolve(new Response(JSON.stringify({ success: false }), { status: 500 }));
        await first;
    });

    it('answers the requests of other users', async () => {
        const fake = backend({ 'POST follow-requests/ana/accept': OK, 'DELETE follow-requests/mateo': OK, 'GET users/lucia': LUCIA, 'GET following': LIST });
        await answerFollowRequest('ana', true);
        await answerFollowRequest('mateo', false);
        expect(requests(fake)).toEqual([
            'POST follow-requests/ana/accept', 'GET users/lucia', 'GET following',
            'DELETE follow-requests/mateo', 'GET users/lucia', 'GET following'
        ]);
    });
});

describe('blocking', () => {
    beforeEach(() => {
        profileStore.update({ viewing: 'lucia' });
    });

    /** Start the block, and answer the question that it asks. */
    async function blockAnswering(confirmed: boolean): Promise<void> {
        const done = blockViewedProfile();
        await vi.waitFor(() => { expect(confirmStore.get().request).not.toBeNull(); });
        expect(confirmStore.get().request?.message).toBe('Block lucia?');
        answerConfirm(confirmed);
        await done;
    }

    it('asks first, blocks, and goes back to the own profile', async () => {
        const fake = backend({ 'PUT blocks/lucia': OK, 'GET users/duvan': LUCIA, 'GET following': LIST });
        await blockAnswering(true);
        expect(requests(fake)).toEqual(['PUT blocks/lucia', 'GET users/duvan', 'GET following']);
        expect(profileStore.get().viewing).toBeNull();
    });

    it('does nothing when the user cancels', async () => {
        const fake = backend({});
        await blockAnswering(false);
        expect(fake).not.toHaveBeenCalled();
        expect(profileStore.get().viewing).toBe('lucia');
    });

    it('stays on the profile when the block fails', async () => {
        backend({ 'PUT blocks/lucia': { status: 500, body: { success: false } } });
        await blockAnswering(true);
        expect(profileStore.get().viewing).toBe('lucia');
        expect(floatingMessageStore.get().error).toBe(true);
    });
});

describe('the search', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('waits until the user stops writing, and asks once', async () => {
        const fake = backend({ 'GET user-search': { status: 200, body: { success: true, users: [{ username: 'lucia', is_private: false, relation: 'none' }] } } });
        setSearchQuery('lu');
        setSearchQuery('luc');
        expect(searchStore.get()).toMatchObject({ query: 'luc', status: 'loading' });
        await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
        expect(fake).toHaveBeenCalledTimes(1);
        expect(queryOf(fake)).toBe('luc');
        expect(searchStore.get()).toMatchObject({ status: 'ready' });
        expect(searchStore.get().results).toHaveLength(1);
    });

    it('does not ask for fewer than two characters, and clears the results', async () => {
        const fake = backend({});
        setSearchQuery('l');
        await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS * 2);
        expect(fake).not.toHaveBeenCalled();
        expect(searchStore.get()).toMatchObject({ query: 'l', status: 'idle', results: [] });
    });

    it('trims the text before asking', async () => {
        const fake = backend({ 'GET user-search': { status: 200, body: { success: true, users: [] } } });
        setSearchQuery('  lu ');
        await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
        expect(queryOf(fake)).toBe('lu');
    });

    it('ignores the answer of a search that the user left behind', async () => {
        const slow = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(slow.promise));
        setSearchQuery('lu');
        await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
        clearSearch();
        slow.resolve(new Response(JSON.stringify({ success: true, users: [{ username: 'lucia', is_private: false, relation: 'none' }] }), { status: 200 }));
        await vi.advanceTimersByTimeAsync(0);
        expect(searchStore.get()).toMatchObject({ query: '', status: 'idle', results: [] });
    });

    it('shows an error when the search fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        backend({});
        setSearchQuery('lu');
        await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
        expect(searchStore.get().status).toBe('error');
    });

    it('follows a user who was found, marks the result, and refreshes the list', async () => {
        vi.useRealTimers();
        const fake = backend({
            'PUT users/lucia/follow': { status: 200, body: { success: true, follow_status: 'pending' } },
            'GET users/duvan': LUCIA, 'GET following': LIST
        });
        searchStore.update({ query: 'lu', status: 'ready', results: [{ username: 'lucia', is_private: true, relation: 'none' }, { username: 'luna', is_private: false, relation: 'none' }] });
        await followFromSearch('lucia');
        expect(searchStore.get().results.map(/** Read a relation. */ (user) => user.relation)).toEqual(['requested', 'none']);
        expect(searchStore.get().pendingUsername).toBeNull();
        expect(requests(fake)).toEqual(['PUT users/lucia/follow', 'GET users/duvan', 'GET following', 'GET user-search']);
    });

    it('tells the user when following from the search fails', async () => {
        vi.useRealTimers();
        backend({});
        searchStore.update({ query: 'lu', status: 'ready', results: [{ username: 'lucia', is_private: false, relation: 'none' }] });
        await followFromSearch('lucia');
        expect(searchStore.get().results[0]?.relation).toBe('none');
        expect(floatingMessageStore.get().error).toBe(true);
    });
});

describe('what a follow leaves', () => {
    it('is a follow when accepted, and a request when pending', () => {
        expect(relationOfFollow('accepted')).toBe('following');
        expect(relationOfFollow('pending')).toBe('requested');
    });
});
