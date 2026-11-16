import { useRef, useState } from 'react';
import { useNow } from '../hooks/useNow';
import { useT } from '../i18n/i18n';
import { withCssVariables } from '../lib/css';
import { formatDurationHoursMinutes } from '../lib/durations';
import { LiveSessionCard, type Anchor } from '../shared/LiveSessionCard';
import type { RankingEntry } from '../types/rooms';
import { MEMBER_STATE_LABELS } from './copy';
import { ringFill, workedSeconds } from './live-session';

/** Draw a small label pill, such as Owner or You. */
function RoomPill({ text }: { text: string }) {
    return <span className="room-pill">{text}</span>;
}

/** Draw the ring that shows a member's state. A member with a session shows how far it has got. */
function MemberRing({ member, worked }: { member: RankingEntry; worked: number }) {
    const t = useT();
    const { filled, over } = ringFill(worked, member.session?.target_time_seconds ?? 0);
    return (
        <span
            className={`member-ring member-ring-${member.state.replace('_', '-')}`}
            role="img"
            aria-label={t(MEMBER_STATE_LABELS[member.state])}
            style={member.session ? withCssVariables({}, { '--ring-pct': `${filled}%`, '--ring-over': `${over}%` }) : undefined}
        ></span>
    );
}

/** Draw one row of the ranking. Hovering the row of a member who is working shows their session. */
function RankingRow({ member, secondsSinceAnswer }: { member: RankingEntry; secondsSinceAnswer: number }) {
    const t = useT();
    const [anchor, setAnchor] = useState<Anchor | null>(null);
    const nameRef = useRef<HTMLSpanElement>(null);
    const { session } = member;
    const worked = session ? workedSeconds(session, member.state, secondsSinceAnswer) : 0;
    return (
        <div
            className={member.is_you ? 'room-ranking-row is-you' : 'room-ranking-row'}
            onMouseEnter={session ? (event) => {
                const row = event.currentTarget.getBoundingClientRect();
                const name = nameRef.current?.getBoundingClientRect();
                setAnchor({ x: name ? name.left + name.width / 2 : row.left + row.width / 2, y: row.top });
            } : undefined}
            onMouseLeave={() => { setAnchor(null); }}
        >
            <span className="room-ranking-position">{String(member.position)}</span>
            <MemberRing member={member} worked={worked} />
            <span className="room-ranking-identity">
                <span ref={nameRef} className="room-ranking-name">{member.username}</span>
                {member.is_owner && <RoomPill text={t('rooms.owner')} />}
                {member.is_you && <RoomPill text={t('rooms.you')} />}
            </span>
            <span className="room-ranking-total">{formatDurationHoursMinutes(member.total_time_seconds)}</span>
            <span className="room-ranking-sessions">{member.sessions_count === 1 ? t('rooms.sessionsOne') : t('rooms.sessionsOther', { count: member.sessions_count })}</span>
            {session && anchor !== null && <LiveSessionCard session={session} worked={worked} anchor={anchor} />}
        </div>
    );
}

interface RoomRankingProps {
    ranking: readonly RankingEntry[];
    /** When the ranking came from the server. Without it, the running sessions stay as the server said. */
    receivedAt?: number | undefined;
}

/** Draw the ranking of the room members, in a card that has its own title. */
export function RoomRanking({ ranking, receivedAt }: RoomRankingProps) {
    const t = useT();
    const isCounting = receivedAt !== undefined && ranking.some(/** Find a member who is working. */ (member) => member.state === 'working');
    const now = useNow(isCounting);
    const secondsSinceAnswer = receivedAt === undefined ? 0 : Math.max(0, now - receivedAt) / 1000;
    return (
        <div id="room-ranking" className="room-ranking">
            <h2 className="room-ranking-title">{t('rooms.ranking')}</h2>
            <div className="room-ranking-rows">
                {ranking.map(/** Draw a member's row. */ (member) => <RankingRow key={member.position} member={member} secondsSinceAnswer={secondsSinceAnswer} />)}
            </div>
        </div>
    );
}
