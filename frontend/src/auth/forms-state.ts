import { createStore } from '../lib/store';

export const authFormStore = createStore<{
    registerEmail: string;
    registerUsername: string;
    registerPassword: string;
    loginIdentifier: string;
    loginPassword: string;
    /** The general error under the Login button. */
    loginError: string;
}>({
    registerEmail: '',
    registerUsername: '',
    registerPassword: '',
    loginIdentifier: '',
    loginPassword: '',
    loginError: ''
});
