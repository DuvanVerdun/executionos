import { useT } from '../i18n/i18n';
import { RoomRanking } from '../rooms/RoomRanking';
import { ProgressRing } from '../shared/ProgressRing';
import { DEMO_RANKING } from './demo';

const CREATOR_PERCENTAGE = 72;
const CREATOR_SESSION_COUNT = 3;
const CREATOR_TIME_LEFT = '41:12';

/** Draw the section that shows a room: its ranking, and someone working in it right now. */
export function RoomsSection() {
    const t = useT();
    return (
        <section className="landing-section landing-rooms" aria-labelledby="landing-rooms-title">
            <div className="landing-demo landing-rooms-ranking" inert>
                <RoomRanking ranking={DEMO_RANKING} />
            </div>
            <div className="landing-rooms-copy">
                <p className="landing-kicker landing-kicker-pain">{t('landing.rooms.kicker')}</p>
                <h2 id="landing-rooms-title" className="landing-title landing-title-left">{t('landing.rooms.title')}</h2>
                <p className="landing-lead landing-lead-left">{t('landing.rooms.text')}</p>
                <div className="landing-card landing-creator" aria-hidden="true">
                    <ProgressRing
                        id="landing-creator-ring"
                        percentage={CREATOR_PERCENTAGE}
                        beforeTargetColor="var(--color-reward)"
                        afterTargetColor="var(--color-reward)"
                    >
                        <div className="landing-creator-ring-mask"></div>
                        <p className="landing-creator-percentage">{`${CREATOR_PERCENTAGE}%`}</p>
                    </ProgressRing>
                    <div className="landing-creator-info">
                        <p className="landing-creator-state"><span className="landing-creator-dot"></span>{t('landing.rooms.workingNow')}</p>
                        <p className="landing-creator-mission">{t('landing.rooms.mission')}</p>
                        <p className="landing-creator-meta">{t('landing.rooms.creatorMeta', { count: CREATOR_SESSION_COUNT, time: CREATOR_TIME_LEFT })}</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
