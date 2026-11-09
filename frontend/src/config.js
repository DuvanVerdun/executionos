// Fixed settings: the backend address and the timing constants.

export let BACKEND_URL = '';

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

export const ROOM_RETRY_WINDOW_MS = 10000;

export const ROOM_RETRY_DELAY_MS = 1500;
