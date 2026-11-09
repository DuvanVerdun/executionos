// Browser features that TypeScript's DOM types do not include.

interface Window {
    /** The prefixed audio context of old Safari. */
    webkitAudioContext?: typeof AudioContext;
}
