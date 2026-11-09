// Plan screen: validation and starting work.

import { parseHHMMToSeconds } from '../lib/durations.js';
import { navigateTo } from '../shared/navigation.js';
import { planDom } from './dom.js';
import { activeSessionState } from './state.js';
import { startTimer } from './timer.js';

/** Return a mission or duration validation error, or an empty string. */
function validatePlan(missionInput = planDom.mission, timeInput = planDom.targetTime) {
    if (!missionInput.value.trim()) return 'Enter your mission.';
    if (missionInput.value.length > 50) return 'Keep your mission to 50 characters or fewer.';
    if (!timeInput.value || !/^\d{2}:\d{2}$/.test(timeInput.value)) {
        return 'Enter a focus time as HH:MM, for example 00:25.';
    }
    const [hours, minutes] = timeInput.value.split(':').map(Number);
    if (minutes > 59) return 'Enter minutes between 00 and 59.';
    if (hours === 0 && minutes === 0) return 'Choose a focus time greater than zero.';
    return '';
}

/** Validate a mission card's fields and show the first error. Return whether they are valid. */
export function validateMissionFields(fields) {
    fields.missionError.textContent = '';
    fields.timeError.textContent = '';
    fields.mission.removeAttribute('aria-invalid');
    fields.targetTime.removeAttribute('aria-invalid');
    const error = validatePlan(fields.mission, fields.targetTime);
    if (!error) return true;
    const isMissionError = !fields.mission.value.trim() || fields.mission.value.length > 50;
    const input = isMissionError ? fields.mission : fields.targetTime;
    const message = isMissionError ? fields.missionError : fields.timeError;
    message.textContent = error;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    return false;
}

/** Validate the plan and start a timestamp-based work session. */
function handleStartWork() {
    if (!validateMissionFields(planDom)) return;
    activeSessionState.currentMission = planDom.mission.value;
    activeSessionState.targetTimeSeconds = parseHHMMToSeconds(planDom.targetTime.value);
    activeSessionState.startTimestamp = new Date().toISOString();
    navigateTo('focus', 'plan');
    startTimer(activeSessionState);
}

/** Apply the target-duration input's keyboard behavior. */
export function handleTargetTimeKeydown(event) {
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
    const characters = input.value.split('');
    characters[digitPosition] = replacement;
    input.value = characters.join('');
    input.setSelectionRange(caretPosition, caretPosition);
    if (input.value !== previousValue) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/** Connect the Plan screen controls. */
export function initPlan() {
    for (const [input, message] of [
        [planDom.mission, planDom.missionError], [planDom.targetTime, planDom.timeError]
    ]) {
        input.addEventListener('input', /** Clear a plan field error when its value changes. */ () => {
            message.textContent = '';
            input.removeAttribute('aria-invalid');
        });
    }
    planDom.targetTime.addEventListener('keydown', handleTargetTimeKeydown);
    planDom.startButton.addEventListener('click', handleStartWork);
}
