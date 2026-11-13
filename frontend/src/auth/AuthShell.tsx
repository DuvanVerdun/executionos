import { useState, type ReactNode } from 'react';
import { useToday } from '../hooks/useToday';
import { getJoinTokenFromHash } from '../rooms/links';
import { Screen } from '../shared/Screen';
import { AuthVisual } from './AuthVisual';
import { InviteCard } from './InviteCard';

interface AuthShellProps {
    screen: 'login' | 'register';
    /** The card with the form. */
    children: ReactNode;
}

/** Draw what Login and Register share: the wordmark, a picture, and the card. Someone who came with a room link also sees the invite card. */
export function AuthShell({ screen, children }: AuthShellProps) {
    const today = useToday();
    const [hasInvite] = useState(() => getJoinTokenFromHash() !== null);

    return (
        <Screen name={screen} className={`${screen}-screen`}>
            <h1 className="wordmark">ExecutionOS</h1>
            <div className="auth-body">
                <AuthVisual screen={screen} today={today} />
                <div className="auth-column">
                    {hasInvite && <InviteCard />}
                    {children}
                </div>
            </div>
        </Screen>
    );
}
