import { useT } from '../i18n/i18n';
import { withCssVariables } from '../lib/css';

/** Draw the card that tells someone who came with a room link that a room is waiting. The same card shows on Login and on Register. */
export function InviteCard() {
    const t = useT();
    return (
        <div className="auth-invite" role="note">
            <p className="auth-invite-label">{t('auth.invite.label')}</p>
            <div className="auth-invite-row">
                <p className="auth-invite-title">{t('auth.invite.title')}</p>
                <div className="auth-invite-rings" aria-hidden="true">
                    <span className="member-ring member-ring-working" style={withCssVariables({}, { '--ring-pct': '70%' })}></span>
                    <span className="member-ring member-ring-working" style={withCssVariables({}, { '--ring-pct': '40%' })}></span>
                    <span className="member-ring member-ring-paused"></span>
                </div>
            </div>
            <p className="auth-invite-text">{t('auth.invite.text')}</p>
        </div>
    );
}
