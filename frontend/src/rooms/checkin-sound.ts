// The check-in sound.

import { CHECKIN_SOUND_URL } from '../config';
import { getServerNowMs } from './clock';
import { checkinAudio, roomSessionState } from './state';

/** Create the audio context on a user gesture, load the sound, and schedule it. */
export async function unlockCheckinAudio(): Promise<void> {
    if (checkinAudio.failed) return;
    try {
        if (!checkinAudio.context) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            checkinAudio.context = new AudioContextClass();
        }
        const context = checkinAudio.context;
        if (context.state === 'running' && checkinAudio.buffer) return;
        if (context.state === 'suspended') await context.resume();
        checkinAudio.loading ??= fetch(CHECKIN_SOUND_URL)
            .then(/** Read the sound file. */ (response) => {
                if (!response.ok) throw new Error(`Sound file not found (${response.status})`);
                return response.arrayBuffer();
            })
            .then(/** Decode the sound file. */ (data) => context.decodeAudioData(data))
            .then(/** Keep the decoded sound. */ (buffer) => { checkinAudio.buffer = buffer; });
        await checkinAudio.loading;
        armCheckinSound();
    } catch (error) {
        checkinAudio.failed = true;
        console.error('Could not prepare the check-in sound:', error);
    }
}

/** Stop a scheduled check-in sound. */
export function cancelCheckinSound(): void {
    try {
        checkinAudio.source?.stop();
    } catch (error) {
        console.error('Could not stop the check-in sound:', error);
    }
    checkinAudio.source = null;
}

/** Schedule the check-in sound on the audio clock, which tab throttling does not delay. */
export function armCheckinSound(): void {
    cancelCheckinSound();
    const { context, buffer } = checkinAudio;
    const { dueAtMs } = roomSessionState.checkin;
    if (!context || !buffer || context.state !== 'running') return;
    if (!roomSessionState.active || roomSessionState.isPaused || dueAtMs === null) return;
    const delayMs = dueAtMs - getServerNowMs();
    if (delayMs < 0) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(context.currentTime + delayMs / 1000);
    checkinAudio.source = source;
}

/** Try to unlock the sound on any click or key press while a room session runs. */
export function handleRoomSessionGesture(): void {
    if (roomSessionState.active) void unlockCheckinAudio();
}
