import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useT } from '../i18n/i18n';
import type { MissionValidationError } from './plan';

interface MissionCardProps {
    /** `plan` or `room`. The stylesheet and the page tests find the elements by these ids. */
    idPrefix: 'plan' | 'room';
    /** The classes of the card. */
    className: string;
    mission: string;
    targetTime: string;
    error: MissionValidationError | null;
    missionInputRef: RefObject<HTMLInputElement | null>;
    targetTimeInputRef: RefObject<HTMLInputElement | null>;
    onMissionChange: (value: string) => void;
    onTargetTimeChange: (value: string) => void;
    onStart: () => void;
    startDisabled?: boolean;
    /** Anything that goes under the Start Work button. */
    children?: ReactNode;
}

/** Draw the mission card. */
export function MissionCard({
    idPrefix, className, mission, targetTime, error, missionInputRef, targetTimeInputRef,
    onMissionChange, onTargetTimeChange, onStart, startDisabled = false, children
}: MissionCardProps) {
    const t = useT();
    const pendingCaret = useRef<number | null>(null);

    useLayoutEffect(() => {
        const caret = pendingCaret.current;
        if (caret === null) return;
        targetTimeInputRef.current?.setSelectionRange(caret, caret);
        pendingCaret.current = null;
    }, [targetTime, targetTimeInputRef]);

    /** Apply the target-duration input's keyboard behavior: a digit or Backspace replaces the digit before the caret. */
    function handleTargetTimeKeydown(event: KeyboardEvent<HTMLInputElement>): void {
        const allowedKeys = /^\d$/.test(event.key) || event.key === 'Backspace';
        if (!allowedKeys) return;
        event.preventDefault();
        const input = event.currentTarget;
        let caretPosition = input.selectionStart;
        if (caretPosition === null || caretPosition === 0) return;
        if (caretPosition === 3) caretPosition = 2;
        const digitPosition = caretPosition - 1;
        const replacement = event.key === 'Backspace' ? '0' : event.key;
        const previousValue = input.value;
        const characters = previousValue.split('');
        characters[digitPosition] = replacement;
        const nextValue = characters.join('');
        if (nextValue === previousValue) {
            input.setSelectionRange(caretPosition, caretPosition);
            return;
        }
        pendingCaret.current = caretPosition;
        onTargetTimeChange(nextValue);
    }

    return (
        <section className={className}>
            <div className="plan-mission-container">
                <h3>{t('mission.heading')}</h3>
                <div className="input-container plan-mission-input-container">
                    <input
                        ref={missionInputRef}
                        type="text"
                        className="input"
                        id={`${idPrefix}-mission-input`}
                        placeholder=" "
                        maxLength={50}
                        aria-describedby={`${idPrefix}-mission-error`}
                        aria-invalid={error?.field === 'mission' ? true : undefined}
                        value={mission}
                        onChange={(event) => { onMissionChange(event.target.value); }}
                    />
                    <p className="input-placeholder">{t('mission.label')}</p>
                </div>
                <p id={`${idPrefix}-mission-error`} className="form-error-message plan-field-error" role="alert">
                    {error?.field === 'mission' ? error.message : ''}
                </p>
            </div>
            <div className="plan-time-container">
                <h3>{t('mission.timeHeading')}</h3>
                <div className="input-container plan-time-input-container">
                    <input
                        ref={targetTimeInputRef}
                        inputMode="numeric"
                        className="input"
                        id={`${idPrefix}-target-time-input`}
                        placeholder=" "
                        maxLength={5}
                        aria-describedby={`${idPrefix}-time-error`}
                        aria-invalid={error?.field === 'targetTime' ? true : undefined}
                        value={targetTime}
                        onChange={(event) => { onTargetTimeChange(event.target.value); }}
                        onKeyDown={handleTargetTimeKeydown}
                    />
                    <p className="input-placeholder">{t('mission.timeLabel')}</p>
                </div>
                <p id={`${idPrefix}-time-error`} className="form-error-message plan-field-error" role="alert">
                    {error?.field === 'targetTime' ? error.message : ''}
                </p>
            </div>
            <button type="button" id={`${idPrefix}-start-work-btn`} className="cta-button" disabled={startDisabled} onClick={onStart}>
                {t('mission.start')}
            </button>
            {children}
        </section>
    );
}
