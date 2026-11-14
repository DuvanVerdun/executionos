/** The two bars of the Pause button. */
export function PauseIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
            <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
        </svg>
    );
}

/** The triangle of the Resume button. */
export function PlayIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 4.5v15L19.5 12z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
    );
}

/** The square of the Stop button. */
export function StopIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
        </svg>
    );
}
