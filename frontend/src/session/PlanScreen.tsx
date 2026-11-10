import { useRef, useState } from 'react';
import { handleOpenDashboard } from '../dashboard/dashboard';
import { useT } from '../i18n/i18n';
import { useStore } from '../lib/store';
import { handleOpenRooms } from '../rooms/rooms';
import { Header } from '../shared/Header';
import { Screen } from '../shared/Screen';
import { MissionCard } from './MissionCard';
import { startWork, validateMissionFields, type MissionValidationError } from './plan';
import { planDraftStore } from './state';

/** Draw the Plan screen. */
export function PlanScreen() {
    const t = useT();
    const { mission, targetTime } = useStore(planDraftStore);
    const [error, setError] = useState<MissionValidationError | null>(null);
    const missionInputRef = useRef<HTMLInputElement>(null);
    const targetTimeInputRef = useRef<HTMLInputElement>(null);

    /** Validate the plan and start a timestamp-based work session. */
    function handleStartWork(): void {
        const validationError = validateMissionFields(mission, targetTime);
        setError(validationError);
        if (validationError) {
            (validationError.field === 'mission' ? missionInputRef : targetTimeInputRef).current?.focus();
            return;
        }
        startWork(mission, targetTime);
    }

    return (
        <Screen name="plan" className="plan-screen">
            <div className="plan-container">
                <Header
                    screen="plan"
                    className="plan-header"
                    navigation={[
                        { id: 'plan-dashboard-btn', label: t('nav.dashboard'), onClick: () => { void handleOpenDashboard(); } },
                        { id: 'plan-rooms-btn', label: t('nav.rooms'), onClick: () => { void handleOpenRooms('plan'); } }
                    ]}
                />

                <section className="plan-content">
                    <MissionCard
                        idPrefix="plan"
                        className="plan-input-section"
                        mission={mission}
                        targetTime={targetTime}
                        error={error}
                        missionInputRef={missionInputRef}
                        targetTimeInputRef={targetTimeInputRef}
                        onMissionChange={(value) => {
                            planDraftStore.update({ mission: value });
                            if (error?.field === 'mission') setError(null);
                        }}
                        onTargetTimeChange={(value) => {
                            planDraftStore.update({ targetTime: value });
                            if (error?.field === 'targetTime') setError(null);
                        }}
                        onStart={handleStartWork}
                    />
                </section>
            </div>
        </Screen>
    );
}
