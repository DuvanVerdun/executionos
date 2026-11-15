import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authStore } from '../auth/state';
import { setLanguage } from '../i18n/i18n';
import { screenStore } from '../shared/navigation';
import { fakeBackendByPath, type FakeAnswer } from '../test/network';
import type { FollowingEntry, LiveState, Profile } from '../types/social';
import { following, IDLE, profile, profileData } from './fixtures';
import { ProfileScreen } from './ProfileScreen';
import { followingStore, profileStore, searchStore } from './state';

const WORKING: LiveState = { state: 'working', percentage: 50, mission: 'Write the pitch', worked_seconds: 1800, target_seconds: 3600 };
const PAUSED: LiveState = { state: 'paused', percentage: 25, mission: null, worked_seconds: 900, target_seconds: 3600 };

/** Show a profile on the screen, with the people that the user follows. */
function showProfile(shown: Profile, list: FollowingEntry[] = []): void {
    profileStore.update({ view: 'ready', profile: shown, receivedAt: Date.now() });
    followingStore.update({ list: { requests: [], following: list }, surface: 'ready', hasLoaded: true, receivedAt: Date.now() });
}

/** Return the answers of a fake backend by "METHOD path" without the query. Anything else fails with 500. */
function backend(routes: Record<string, FakeAnswer>) {
    return fakeBackendByPath((path, init) => routes[`${init?.method ?? 'GET'} ${path.split('?')[0] ?? ''}`] ?? { status: 500 });
}

beforeEach(() => {
    authStore.update({ accessToken: 'token', userId: 1, username: 'duvan' });
    screenStore.set({ screen: 'profile' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('the card of a profile', () => {
    it('shows the username, the counts, and when the user was last active', () => {
        showProfile(profile({ username: 'lucia', followers_count: 14, following_count: 3, data: profileData({ last_activity_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString().replace('Z', '') }) }));
        render(<ProfileScreen />);
        const card = screen.getByRole('complementary', { name: 'lucia' });
        expect(within(card).getByRole('heading', { name: 'lucia' })).toBeInTheDocument();
        expect(card).toHaveTextContent('14Followers');
        expect(card).toHaveTextContent('3Following');
        expect(card).toHaveTextContent('Active 2 hr. ago');
    });

    it('says there is no activity yet for a user who never worked', () => {
        showProfile(profile());
        render(<ProfileScreen />);
        expect(screen.getByText('No activity yet')).toBeInTheDocument();
    });

    it.each([
        ['working', WORKING, 'Working now'],
        ['paused', PAUSED, 'Paused']
    ] as const)('shows that the user is %s', (_name, live, text) => {
        showProfile(profile({ data: profileData({ live }) }));
        render(<ProfileScreen />);
        expect(within(screen.getByRole('complementary')).getByText(text)).toBeInTheDocument();
        expect(within(screen.getByRole('complementary')).getByRole('img', { name: text === 'Paused' ? 'Paused' : 'Working' })).toBeInTheDocument();
    });

    it('has no follow button on the own profile, and no menu either', () => {
        showProfile(profile({ username: 'duvan', relation: 'self' }));
        render(<ProfileScreen />);
        const card = screen.getByRole('complementary', { name: 'duvan' });
        expect(within(card).queryByRole('button')).toBeNull();
    });

    it.each([
        ['a public account', { is_private: false, follows_you: false }, 'Follow'],
        ['a public account that follows the user', { is_private: false, follows_you: true }, 'Follow back'],
        ['a private account', { is_private: true, follows_you: false }, 'Request to follow']
    ] as const)('offers to follow %s', async (_name, overrides, label) => {
        const fake = backend({ 'PUT users/lucia/follow': { status: 200, body: { success: true, follow_status: 'accepted' } }, 'GET users/lucia': { status: 500 }, 'GET following': { status: 500 } });
        profileStore.update({ viewing: 'lucia' });
        showProfile(profile({ relation: 'none', data: null, ...overrides }));
        render(<ProfileScreen />);
        await userEvent.click(screen.getByRole('button', { name: label }));
        expect(fake.mock.calls.map(/** Read the method. */ ([, init]) => init?.method)).toContain('PUT');
    });

    it('shows that the user follows, and that a request waits, without a button to follow', () => {
        showProfile(profile({ relation: 'following' }));
        const { unmount } = render(<ProfileScreen />);
        expect(within(screen.getByRole('complementary')).getByRole('status')).toHaveTextContent('Following');
        unmount();
        showProfile(profile({ relation: 'requested', data: null, is_private: true }));
        render(<ProfileScreen />);
        expect(within(screen.getByRole('complementary')).getByRole('status')).toHaveTextContent('Request sent');
    });

    it('shows that they follow the user', () => {
        showProfile(profile({ relation: 'none', follows_you: true, data: null }));
        render(<ProfileScreen />);
        expect(screen.getByText('Follows you')).toBeInTheDocument();
    });
});

describe('the menu of someone else', () => {
    it('offers to unfollow and to block a person who is followed, and closes with Escape', async () => {
        showProfile(profile({ relation: 'following' }));
        render(<ProfileScreen />);
        await userEvent.click(screen.getByRole('button', { name: 'More options' }));
        expect(screen.getAllByRole('menuitem').map(/** Read an item. */ (item) => item.textContent)).toEqual(['Unfollow', 'Block']);
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('offers to cancel a request, and only to block someone who is not followed', async () => {
        showProfile(profile({ relation: 'requested', data: null }));
        const { unmount } = render(<ProfileScreen />);
        await userEvent.click(screen.getByRole('button', { name: 'More options' }));
        expect(screen.getAllByRole('menuitem').map(/** Read an item. */ (item) => item.textContent)).toEqual(['Cancel request', 'Block']);
        unmount();
        showProfile(profile({ relation: 'none', data: null }));
        render(<ProfileScreen />);
        await userEvent.click(screen.getByRole('button', { name: 'More options' }));
        expect(screen.getAllByRole('menuitem').map(/** Read an item. */ (item) => item.textContent)).toEqual(['Block']);
    });

    it('unfollows from the menu', async () => {
        const fake = backend({ 'DELETE users/lucia/follow': { status: 200, body: { success: true } } });
        profileStore.update({ viewing: 'lucia' });
        showProfile(profile({ relation: 'following' }));
        render(<ProfileScreen />);
        await userEvent.click(screen.getByRole('button', { name: 'More options' }));
        await userEvent.click(screen.getByRole('menuitem', { name: 'Unfollow' }));
        expect(fake.mock.calls[0]?.[1]?.method).toBe('DELETE');
        expect(screen.queryByRole('menu')).toBeNull();
    });
});

describe('the data of a profile', () => {
    it('shows the streak, and the best one', () => {
        showProfile(profile({ data: profileData({ streak: { current: 21, best: 34 } }) }));
        render(<ProfileScreen />);
        expect(screen.getByText('day streak').previousElementSibling).toHaveTextContent('21');
        expect(screen.getByText('Best streak').previousElementSibling).toHaveTextContent('34');
    });

    it('draws the 182 days of the heatmap with the work, rest and today days marked, and a label for each month', () => {
        showProfile(profile());
        const { container } = render(<ProfileScreen />);
        expect(container.querySelectorAll('.profile-heatmap-days .heatmap-day')).toHaveLength(182);
        expect(container.querySelectorAll('.profile-heatmap-days .heatmap-day-work')).toHaveLength(1);
        expect(container.querySelectorAll('.profile-heatmap-days .heatmap-day-rest')).toHaveLength(1);
        expect(container.querySelectorAll('.profile-heatmap-days .heatmap-day-today')).toHaveLength(1);
        const months = Array.from(container.querySelectorAll('.profile-heatmap-months span'), /** Read a label. */ (label) => label.textContent);
        expect(months).toHaveLength(7);
        expect(months[0]).toBe('May');
        expect(months.at(-1)).toBe('Nov');
        expect(screen.getByRole('img', { name: 'Days worked in the last 6 months' })).toBeInTheDocument();
    });

    it('shows the four numbers of the last 30 days', () => {
        showProfile(profile());
        const { container } = render(<ProfileScreen />);
        const cards = Array.from(container.querySelectorAll('.profile-stats .dashboard-summary-card'), /** Read a card. */ (card) => card.textContent);
        expect(cards).toEqual(['1h 30mFocused', '4Sessions', '3Days Worked', '22mAvg. Session Time']);
    });

    it('shows a dash for the average of a user without sessions', () => {
        showProfile(profile({ data: profileData({ stats: { total_time_seconds: 0, total_sessions: 0, days_worked: 0, average_session_time_seconds: null } }) }));
        const { container } = render(<ProfileScreen />);
        expect(container.querySelectorAll('.profile-stats .dashboard-summary-value')[3]).toHaveTextContent('—');
    });

    it('writes the profile in Spanish when Spanish shows', () => {
        setLanguage('es');
        showProfile(profile({ data: profileData({ streak: { current: 1, best: 1 } }) }));
        render(<ProfileScreen />);
        expect(screen.getByText('día de racha')).toBeInTheDocument();
        expect(screen.getByText('Últimos 6 meses')).toBeInTheDocument();
        expect(screen.getByText('Últimos 30 días')).toBeInTheDocument();
    });
});

describe('a profile that the user may not see', () => {
    it.each([
        ['public', { is_private: false, relation: 'none' as const }, 'Follow lucia to see their progress'],
        ['private', { is_private: true, relation: 'none' as const }, 'Private account'],
        ['private with a request', { is_private: true, relation: 'requested' as const }, 'Private account']
    ])('shows the card and no data for a %s account', (_name, overrides, title) => {
        showProfile(profile({ data: null, ...overrides }));
        const { container } = render(<ProfileScreen />);
        expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
        expect(container.querySelector('.profile-heatmap')).toBeNull();
        expect(screen.getByRole('complementary', { name: 'lucia' })).toBeInTheDocument();
    });

    it('says what a request is waiting for', () => {
        showProfile(profile({ data: null, is_private: true, relation: 'requested' }));
        render(<ProfileScreen />);
        expect(screen.getByText('Your request is waiting for their answer.')).toBeInTheDocument();
    });
});

describe('the states of the screen', () => {
    it('shows placeholders while the profile loads', () => {
        profileStore.update({ view: 'loading', profile: null });
        render(<ProfileScreen />);
        expect(screen.getByRole('status', { name: 'Loading profile' })).toBeInTheDocument();
    });

    it('shows an error with a retry that loads the profile again', async () => {
        const fake = backend({ 'GET users/duvan': { status: 200, body: { success: true, profile: profile({ username: 'duvan', relation: 'self' }) } } });
        profileStore.update({ view: 'error', profile: null });
        render(<ProfileScreen />);
        expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the profile.");
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(fake).toHaveBeenCalledTimes(1);
        expect(await screen.findByRole('complementary', { name: 'duvan' })).toBeInTheDocument();
    });

    it('says the user is not found, and goes back to the own profile', async () => {
        backend({ 'GET users/duvan': { status: 500 } });
        profileStore.update({ view: 'notFound', profile: null, viewing: 'ghost' });
        render(<ProfileScreen />);
        expect(screen.getByRole('alert')).toHaveTextContent("We couldn't find this user.");
        await userEvent.click(screen.getByRole('button', { name: 'Go to my profile' }));
        expect(profileStore.get().viewing).toBeNull();
    });
});

describe('the list of people the user follows', () => {
    it('shows each person with their streak, and marks the one whose profile shows', () => {
        profileStore.update({ viewing: 'lucia' });
        showProfile(profile(), [following('lucia', { streak: 21 }), following('mateo', { streak: 5 })]);
        render(<ProfileScreen />);
        const rows = screen.getAllByRole('button').filter(/** Keep the rows of people. */ (button) => button.classList.contains('following-row'));
        expect(rows.map(/** Read a row. */ (row) => row.textContent)).toEqual(['Llucia🔥 21', 'Mmateo🔥 5']);
        expect(rows[0]).toHaveAttribute('aria-current', 'page');
        expect(rows[1]).not.toHaveAttribute('aria-current');
        expect(screen.getByRole('heading', { name: /^Following ?2$/ })).toBeInTheDocument();
    });

    it('opens the profile of a person when their row is clicked', async () => {
        const fake = backend({ 'GET users/mateo': { status: 200, body: { success: true, profile: profile({ username: 'mateo' }) } } });
        showProfile(profile(), [following('mateo')]);
        render(<ProfileScreen />);
        await userEvent.click(screen.getByRole('button', { name: /mateo/ }));
        expect(profileStore.get().viewing).toBe('mateo');
        expect(fake).toHaveBeenCalledTimes(1);
    });

    it('shows a ring on the people who are working or paused, and the pause bars on the paused one', () => {
        showProfile(profile(), [following('lucia', { live: WORKING }), following('noa', { live: PAUSED }), following('mateo', { live: IDLE })]);
        const { container } = render(<ProfileScreen />);
        expect(container.querySelectorAll('.following-row .profile-avatar.is-working')).toHaveLength(1);
        expect(container.querySelectorAll('.following-row .profile-avatar.is-paused')).toHaveLength(1);
        expect(container.querySelectorAll('.following-row .profile-avatar.is-paused .profile-avatar-bar')).toHaveLength(2);
        expect(container.querySelectorAll('.following-row .profile-avatar.has-ring')).toHaveLength(2);
        expect(Number.parseFloat(container.querySelector<HTMLElement>('.following-row .profile-avatar.is-working')?.style.getPropertyValue('--ring-pct') ?? '')).toBeCloseTo(50, 0);
    });

    it('shows the session of a person who is working when their row is hovered, and nothing for the others', () => {
        showProfile(profile(), [following('lucia', { live: WORKING }), following('mateo', { live: IDLE })]);
        render(<ProfileScreen />);
        fireEvent.mouseEnter(screen.getByRole('button', { name: /lucia/ }));
        expect(screen.getByRole('tooltip')).toHaveTextContent('Write the pitch');
        expect(screen.getByRole('tooltip')).toHaveTextContent('30:00 / 1:00:00 · 50%');
        fireEvent.mouseLeave(screen.getByRole('button', { name: /lucia/ }));
        fireEvent.mouseEnter(screen.getByRole('button', { name: /mateo/ }));
        expect(screen.queryByRole('tooltip')).toBeNull();
    });

    it('shows an invitation to search when the user follows nobody', () => {
        showProfile(profile());
        render(<ProfileScreen />);
        expect(screen.getByText("You don't follow anyone yet")).toBeInTheDocument();
    });

    it('shows placeholders while it loads, and an error with a retry', async () => {
        showProfile(profile());
        followingStore.update({ surface: 'loading', hasLoaded: false });
        const { unmount } = render(<ProfileScreen />);
        expect(screen.getByRole('status', { name: 'Loading the list' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Following' })).toBeInTheDocument();
        unmount();
        const fake = backend({ 'GET following': { status: 200, body: { success: true, requests: [], following: [following('mateo')] } } });
        followingStore.update({ surface: 'error' });
        render(<ProfileScreen />);
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(fake).toHaveBeenCalledTimes(1);
        expect(await screen.findByRole('button', { name: /mateo/ })).toBeInTheDocument();
    });

    it('shows the requests above the list, and accepts or declines them', async () => {
        const fake = backend({ 'POST follow-requests/ana/accept': { status: 200, body: { success: true } }, 'DELETE follow-requests/jose': { status: 200, body: { success: true } } });
        showProfile(profile());
        followingStore.update({ list: { requests: [{ username: 'ana' }, { username: 'jose' }], following: [following('mateo')] } });
        render(<ProfileScreen />);
        expect(screen.getByRole('heading', { name: /^Requests ?2$/ })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Accept the request of ana' }));
        await userEvent.click(screen.getByRole('button', { name: 'Decline the request of jose' }));
        expect(fake.mock.calls.map(/** Read the method. */ ([, init]) => init?.method).filter(/** Keep the changes. */ (method) => method !== 'GET')).toEqual(['POST', 'DELETE']);
    });
});

describe('the search', () => {
    it('writes in the box, and clears it with the button or Escape', () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        showProfile(profile());
        render(<ProfileScreen />);
        const box = screen.getByRole('textbox', { name: 'Search user' });
        fireEvent.change(box, { target: { value: 'lu' } });
        expect(searchStore.get().query).toBe('lu');
        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
        expect(searchStore.get().query).toBe('');
        fireEvent.change(box, { target: { value: 'lu' } });
        fireEvent.keyDown(box, { key: 'Escape' });
        expect(searchStore.get().query).toBe('');
        vi.useRealTimers();
    });

    it('shows the users found with the action of each, and opens one', async () => {
        const fake = backend({ 'GET users/maria': { status: 200, body: { success: true, profile: profile({ username: 'maria' }) } } });
        showProfile(profile(), [following('mateo')]);
        searchStore.update({
            query: 'ma', status: 'ready',
            results: [
                { username: 'mateo', is_private: false, relation: 'following' },
                { username: 'maria', is_private: false, relation: 'none' },
                { username: 'marcos', is_private: true, relation: 'none' },
                { username: 'marta', is_private: true, relation: 'requested' }
            ]
        });
        render(<ProfileScreen />);
        expect(screen.getByText('Results')).toBeInTheDocument();
        expect(screen.getByText('Following', { selector: '.following-action' })).toBeInTheDocument();
        expect(screen.getByText('Requested')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Request' })).toBeInTheDocument();
        expect(screen.getAllByRole('img', { name: 'Private account' })).toHaveLength(2);
        await userEvent.click(screen.getByRole('button', { name: /maria/ }));
        expect(fake).toHaveBeenCalledTimes(1);
        expect(profileStore.get().viewing).toBe('maria');
    });

    it('shows that nothing was found, a wait, and an error', () => {
        showProfile(profile());
        searchStore.update({ query: 'zz', status: 'ready', results: [] });
        const { unmount } = render(<ProfileScreen />);
        expect(screen.getByText('No results')).toBeInTheDocument();
        expect(screen.getByText('No users with that name.')).toBeInTheDocument();
        unmount();
        searchStore.update({ status: 'loading' });
        const second = render(<ProfileScreen />);
        expect(screen.getByRole('status', { name: 'Loading the list' })).toBeInTheDocument();
        second.unmount();
        searchStore.update({ status: 'error' });
        render(<ProfileScreen />);
        expect(screen.getByText("Couldn't load the list.")).toBeInTheDocument();
    });
});
