export let BACKEND_URL: string = '';

if (window.location.hostname === 'executionos-mvp.netlify.app') {
    BACKEND_URL = 'https://executionos.onrender.com';
} else if (window.location.hostname === 'localhost') {
    BACKEND_URL = 'https://localhost:5000';
}

export const ROOM_POLL_INTERVAL_MS = 15000;

export const ROOM_REQUEST_TIMEOUT_MS = 20000;

export const ROOM_JOIN_FRAGMENT = '#join=';

export const BEAT_AVERAGE_INCREMENT_SECONDS = 60;

export const HEARTBEAT_INTERVAL_MS = 15000;

export const CHECKIN_SOUND_URL = 'sounds/checkin.mp3';

export const CHECKIN_INTERVAL_MS = 3600000;

export const CHECKIN_RESPONSE_MS = 300000;

/** How often the check-in sound repeats while the check-in waits for an answer. */
export const CHECKIN_SOUND_REPEAT_MS = 10000;

export const ROOM_RETRY_WINDOW_MS = 10000;

export const ROOM_RETRY_DELAY_MS = 1500;

/** How often the Profile screen refreshes the profile and the people the user follows. */
export const SOCIAL_POLL_INTERVAL_MS = 15000;

export const SOCIAL_REQUEST_TIMEOUT_MS = 20000;

/** How long the search waits after the last key before it asks the server. */
export const SEARCH_DEBOUNCE_MS = 300;

export const SEARCH_MIN_LENGTH = 2;
