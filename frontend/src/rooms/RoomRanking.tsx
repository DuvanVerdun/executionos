import { withCssVariables } from '../lib/css';
import { formatDurationHoursMinutes } from '../lib/durations';
import type { RankingEntry } from '../types/rooms';
import { MEMBER_STATE_LABELS } from './copy';

/** Draw a small label pill, such as Owner or You. */
function RoomPill({ text }: { text: string }) {
    return <span className="room-pill">{text}</span>;
}

/** Draw the ring that shows a member's state. */
function MemberRing({ member }: { member: RankingEntry }) {
    return (
        <span
            className={`member-ring member-ring-${member.state.replace('_', '-')}`}
            role="img"
            aria-label={MEMBER_STATE_LABELS[member.state]}
            style={member.state === 'working' ? withCssVariables({}, { '--ring-pct': `${member.ring_percentage ?? 0}%` }) : undefined}
        ></span>
    );
}

/** Draw one row of the ranking. */
function RankingRow({ member }: { member: RankingEntry }) {
    return (
        <div className={member.is_you ? 'room-ranking-row is-you' : 'room-ranking-row'}>
            <span className="room-ranking-position">{String(member.position)}</span>
            <MemberRing member={member} />
            <span className="room-ranking-identity">
                <span className="room-ranking-name">{member.username}</span>
                {member.is_owner && <RoomPill text="Owner" />}
                {member.is_you && <RoomPill text="You" />}
            </span>
            <span className="room-ranking-total">{formatDurationHoursMinutes(member.total_time_seconds)}</span>
            <span className="room-ranking-sessions">{`${member.sessions_count} ${member.sessions_count === 1 ? 'session' : 'sessions'}`}</span>
        </div>
    );
}

/** Draw the ranking of the room members. */
export function RoomRanking({ ranking }: { ranking: readonly RankingEntry[] }) {
    return (
        <div id="room-ranking" className="room-ranking">
            {ranking.map(/** Draw a member's row. */ (member) => <RankingRow key={member.position} member={member} />)}
        </div>
    );
}
