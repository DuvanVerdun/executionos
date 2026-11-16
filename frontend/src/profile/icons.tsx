/** The three dots of a menu button. */
export function DotsIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="5" cy="12" r="2" fill="currentColor" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
            <circle cx="19" cy="12" r="2" fill="currentColor" />
        </svg>
    );
}

/** A check mark. */
export function CheckIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

/** A magnifying glass. */
export function SearchIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m15.5 15.5 5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

/** A closed padlock. */
export function LockIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

/** A person with a plus. */
export function AddPersonIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M19 6v6M16 9h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

/** The gear of the settings. */
export function GearIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M19.31 9.91 22.07 10.4V13.6L19.31 14.09 18.65 15.68 20.25 18 18 20.25 15.68 18.65 14.09 19.31 13.6 22.07H10.4L9.91 19.31 8.32 18.65 6 20.25 3.75 18 5.35 15.68 4.69 14.09 1.93 13.6V10.4L4.69 9.91 5.35 8.32 3.75 6 6 3.75 8.32 5.35 9.91 4.69 10.4 1.93H13.6L14.09 4.69 15.68 5.35 18 3.75 20.25 6 18.65 8.32Z"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
            />
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}
