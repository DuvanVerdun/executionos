import { createStore } from '../lib/store';
import type { FollowingList, Profile, SearchUser } from '../types/social';

/** What the profile area shows: placeholders, the profile, an error, or the message for a user who is not there. */
export type ProfileView = 'loading' | 'ready' | 'error' | 'notFound';

interface ProfileState {
    /** The username whose profile shows. Null is the user's own. */
    viewing: string | null;
    /** What the area beside the card shows: the data and the list, or the settings of the account. */
    panel: 'profile' | 'settings';
    view: ProfileView;
    profile: Profile | null;
    /** When the profile came from the server, so a session that is working counts on from then. */
    receivedAt: number;
    isLoading: boolean;
    /** True while a follow, an unfollow or a block runs. */
    isBusy: boolean;
}

export const profileStore = createStore<ProfileState>({
    viewing: null,
    panel: 'profile',
    view: 'loading',
    profile: null,
    receivedAt: 0,
    isLoading: false,
    isBusy: false
});

/** A profile that was loaded before and when. The user sees it at once when they open it again, while the server refreshes it. */
interface CachedProfile {
    profile: Profile;
    receivedAt: number;
}

export const profileCache = new Map<string, CachedProfile>();

/** What the list of people the user follows shows: placeholders, the list, or an error. */
export type FollowingSurface = 'loading' | 'ready' | 'error';

interface FollowingState {
    list: FollowingList;
    surface: FollowingSurface;
    hasLoaded: boolean;
    isLoading: boolean;
    /** When the list came from the server, so the sessions that are working count on from then. */
    receivedAt: number;
}

export const followingStore = createStore<FollowingState>({
    list: { requests: [], following: [] },
    surface: 'loading',
    hasLoaded: false,
    isLoading: false,
    receivedAt: 0
});

/** What the search shows: nothing, a wait, the users found, or an error. */
export type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SearchState {
    /** What is written in the search box. */
    query: string;
    status: SearchStatus;
    results: SearchUser[];
    /** The user whose follow button is waiting for the server. */
    pendingUsername: string | null;
}

export const searchStore = createStore<SearchState>({
    query: '',
    status: 'idle',
    results: [],
    pendingUsername: null
});
