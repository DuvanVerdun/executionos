import { useStore } from '../lib/store';
import { floatingMessageStore } from './floating-message';

/** Show the floating message. */
export function FloatingMessage() {
    const { message, saved, error, isFading, isHidden } = useStore(floatingMessageStore);
    const classes = [
        'session-save-message',
        'floating-message',
        saved ? 'session-save-success' : '',
        error ? 'session-save-error' : '',
        isFading ? 'is-fading' : ''
    ].filter(Boolean).join(' ');
    return (
        <p id="floating-message" className={classes} role="status" aria-live="polite" hidden={isHidden}>
            {message}
        </p>
    );
}
