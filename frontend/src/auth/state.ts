import { createStore } from '../lib/store';

interface AuthState {
    accessToken: string | null;
    userId: number | null;
    /** The name shown in the account menus. */
    username: string;
}

export const authStore = createStore<AuthState>({
    accessToken: null,
    userId: null,
    username: ''
});
