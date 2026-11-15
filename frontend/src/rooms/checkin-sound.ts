import { CHECKIN_RESPONSE_MS, CHECKIN_SOUND_REPEAT_MS, CHECKIN_SOUND_URL } from '../config';
import { roomSessionStore } from './room-session-state';
import { checkinAudio } from './state';

/** Create the audio context on a user gesture, load the sound, and schedule it. Old Safari only has the prefixed context name. */
export async function unlockCheckinAudio(): Promise<void> {
    if (checkinAudio.failed) return;
    try {
        if (!checkinAudio.context) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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

/** Stop the scheduled check-in sounds. */
export function cancelCheckinSound(): void {
    for (const source of checkinAudio.sources) {
        try {
            source.stop();
        } catch (error) {
            console.error('Could not stop the check-in sound:', error);
        }
    }
    checkinAudio.sources = [];
}

/**
 * Schedule the check-in sound on the audio clock, which tab throttling does not delay. It plays when the check-in
 * is due and again every few seconds until the time to answer is over. The repeats that are already past are skipped.
 */
export function armCheckinSound(): void {
    cancelCheckinSound();
    const { context, buffer } = checkinAudio;
    const { checkin, active, isPaused } = roomSessionStore.get();
    const { dueAtMs } = checkin;
    if (!context || !buffer || context.state !== 'running') return;
    if (!active || isPaused || dueAtMs === null) return;
    const repeats = Math.ceil(CHECKIN_RESPONSE_MS / CHECKIN_SOUND_REPEAT_MS);
    for (let repeat = 0; repeat < repeats; repeat += 1) {
        const delayMs = dueAtMs + repeat * CHECKIN_SOUND_REPEAT_MS - Date.now();
        if (delayMs < 0) continue;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.start(context.currentTime + delayMs / 1000);
        checkinAudio.sources.push(source);
    }
}

/** Try to unlock the sound on any click or key press while a room session runs. */
export function handleRoomSessionGesture(): void {
    if (roomSessionStore.get().active) void unlockCheckinAudio();
}
