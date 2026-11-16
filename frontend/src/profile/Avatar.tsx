import { useT } from '../i18n/i18n';
import { withCssVariables } from '../lib/css';
import { MEMBER_STATE_LABELS } from '../rooms/copy';
import type { MemberState } from '../types/rooms';

interface AvatarProps {
    username: string;
    size: 'small' | 'large';
    state?: MemberState;
    /** How much of the ring each color fills. Only a user with a session has it. */
    ring?: { filled: number; over: number };
}

/**
 * Draw the avatar of a user: their initial inside a ring. A user with a session shows how far it has got on the ring,
 * and the pause bars instead of the initial while it is paused. The large avatar keeps its empty ring when the user is not working.
 */
export function Avatar({ username, size, state = 'not_working', ring }: AvatarProps) {
    const t = useT();
    const inSession = state !== 'not_working';
    const classes = ['profile-avatar', `profile-avatar-${size}`];
    if (inSession || size === 'large') classes.push('has-ring');
    if (inSession) classes.push(`is-${state}`);
    return (
        <span
            className={classes.join(' ')}
            role="img"
            aria-label={t(MEMBER_STATE_LABELS[state])}
            style={ring ? withCssVariables({}, { '--ring-pct': `${ring.filled}%`, '--ring-over': `${ring.over}%` }) : undefined}
        >
            <span className="profile-avatar-face">
                {state === 'paused' ? <><i className="profile-avatar-bar"></i><i className="profile-avatar-bar"></i></> : username.charAt(0).toUpperCase()}
            </span>
        </span>
    );
}
